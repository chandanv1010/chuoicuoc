import "server-only";
import { createHmac } from "node:crypto";
import { now } from "@/lib/helpers";
import { requestJson, sleep, SocialError } from "@/modules/social/http";
import type { AccountRow, ShopOption } from "../accounts";
import { credentials, marketEnv } from "../config";
import type { ListingProgress } from "../listings";
import type { ListingSettings, ProductSnapshot } from "../types";
import type { CategoryAttribute, CategoryItem, MarketplaceAdapter, OAuthTokens, SyncJob, SyncResult } from "./base";
import { basePrice, cached, commonValidate, marketPrice, packageOf, parseAttributes, readImage, sellableVariants, variantSku } from "./common";

/**
 * Shopee Open Platform API v2 (https://open.shopee.com/documents/v2)
 *  - Ky: sign = HMAC-SHA256(partner_key, partner_id + path + timestamp [+ access_token + shop_id]) dang hex;
 *    tham so chung tren query: partner_id, timestamp, sign, access_token, shop_id.
 *  - Ket noi: /api/v2/shop/auth_partner?redirect=... -> Shopee chuyen ve kem code + shop_id ->
 *    POST /api/v2/auth/token/get. Access token song 4 gio, refresh token 30 ngay (/api/v2/auth/access_token/get).
 *  - Day san pham: media_space/upload_image (tung anh) -> product/add_item -> product/init_tier_variation (neu co bien the).
 *    Cap nhat: product/update_item + update_price + update_stock (theo model_id lay tu get_model_list).
 *  - Loi tra HTTP 200 kem { error: "...", message }: kiem tra truong error.
 *  - SHOPEE_SANDBOX=1 -> partner.test-stable.shopeemobile.com (app thu cua Shopee).
 */

const host = () => (marketEnv("SHOPEE_SANDBOX") === "1" ? "https://partner.test-stable.shopeemobile.com" : "https://partner.shopeemobile.com");
const MAX_IMAGES = 9;
const CURRENCY = "VND" as const;

type ShopeeBody = { error?: string; message?: string; response?: unknown; request_id?: string; [k: string]: unknown };

const isAuthErr = (status: number, body: unknown) => status === 403 || /error_auth|invalid_acc?ess_token|invalid_token|access_token.*expired/i.test(String((body as ShopeeBody)?.error ?? ""));

function signed(path: string, token?: string, shopId?: string) {
  const { id, secret } = credentials("shopee");
  const ts = Math.floor(Date.now() / 1000);
  const base = `${id}${path}${ts}${token ?? ""}${shopId ?? ""}`;
  const sign = createHmac("sha256", secret).update(base).digest("hex");
  const q = new URLSearchParams({ partner_id: id, timestamp: String(ts), sign });
  if (token) q.set("access_token", token);
  if (shopId) q.set("shop_id", shopId);
  return q;
}

async function call<T = Record<string, unknown>>(
  method: "GET" | "POST",
  path: string,
  opts: { token?: string; shopId?: string; query?: Record<string, string | number>; json?: unknown; multipart?: FormData } = {},
): Promise<T> {
  const q = signed(path, opts.token, opts.shopId);
  for (const [k, v] of Object.entries(opts.query ?? {})) q.set(k, String(v));
  const headers: Record<string, string> = {};
  let body: BodyInit | undefined;
  if (opts.json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.json);
  } else if (opts.multipart) body = opts.multipart;
  const res = await requestJson<ShopeeBody>(`${host()}${path}?${q}`, { method, headers, body }, isAuthErr);
  if (res.error) {
    const auth = isAuthErr(200, res);
    throw new SocialError(`Shopee ${path}: ${res.error} ${res.message ?? ""}`.trim(), { auth, retryable: /too_many|rate|system_busy/i.test(res.error) });
  }
  await sleep(120);
  return (res.response ?? res) as T;
}

function tokens(t: { access_token?: string; refresh_token?: string; expire_in?: number }, hint?: Record<string, string>): OAuthTokens {
  if (!t.access_token) throw new SocialError("Shopee không trả về access token.");
  const n = now().getTime();
  return {
    access_token: t.access_token,
    refresh_token: t.refresh_token ?? null,
    expires_at: new Date(n + (t.expire_in ?? 14_400) * 1000),
    refresh_expires_at: t.refresh_token ? new Date(n + 30 * 86_400_000) : null,
    scopes: null,
    hint,
  };
}

/* ------------------------------ Du lieu gui len ------------------------------ */

const title = (p: ProductSnapshot, s: ListingSettings) => (s.title || p.name).replace(/\s+/g, " ").trim().slice(0, 120);
const description = (p: ProductSnapshot, s: ListingSettings) => (s.description || p.description).trim().slice(0, 3000);

function itemBody(p: ProductSnapshot, s: ListingSettings, extra: { images: string[]; logistics: { logistic_id: number; enabled: boolean }[]; attributes: unknown[]; brand: { brand_id: number; original_brand_name: string } }) {
  const pkg = packageOf(s);
  const hasModels = sellableVariants(p).length > 0;
  return {
    item_name: title(p, s),
    description: description(p, s),
    category_id: Number(s.category_id),
    original_price: marketPrice(basePrice(p), s, CURRENCY),
    seller_stock: [{ stock: hasModels ? 0 : Math.max(0, Math.floor(p.stock || 0)) }],
    weight: pkg?.weight_kg ?? 0,
    ...(pkg && pkg.length && pkg.width && pkg.height ? { dimension: { package_length: pkg.length, package_width: pkg.width, package_height: pkg.height } } : {}),
    image: { image_id_list: extra.images },
    logistic_info: extra.logistics,
    attribute_list: extra.attributes,
    brand: extra.brand,
    item_status: s.publish === "active" ? "NORMAL" : "UNLIST",
    condition: "NEW",
    item_sku: p.code && p.code !== "0" ? p.code.slice(0, 100) : undefined,
  };
}

/** tier_variation + model cho init_tier_variation (toi da 2 tang). */
export function tierBody(p: ProductSnapshot, s: ListingSettings) {
  const vs = sellableVariants(p);
  const tiers = p.options.slice(0, 2).map((name, i) => ({
    name: name.slice(0, 14),
    option_list: [...new Set(vs.map((v) => (v.values[i] ?? "-").slice(0, 30)))].map((option) => ({ option })),
  }));
  const model = vs.map((v, k) => ({
    tier_index: tiers.map((t, i) => t.option_list.findIndex((o) => o.option === (v.values[i] ?? "-").slice(0, 30))),
    original_price: marketPrice(v.price || basePrice(p), s, CURRENCY),
    model_sku: variantSku(p, k),
    seller_stock: [{ stock: Math.max(0, Math.floor(v.quantity || 0)) }],
  }));
  return { tier_variation: tiers, model };
}

/* ------------------------------ Adapter ------------------------------ */

type Category = { category_id: number; parent_category_id: number; original_category_name: string; display_category_name?: string; has_children: boolean };
type Attr = { attribute_id: number; original_attribute_name: string; display_attribute_name?: string; is_mandatory: boolean; attribute_value_list?: { value_id: number; original_value_name: string; display_value_name?: string }[] };

async function attributesOf(token: string, shopId: string, categoryId: string) {
  return cached(`shopee:attr:${categoryId}`, async () => {
    const r = await call<{ attribute_list?: Attr[] }>("GET", "/api/v2/product/get_attributes", { token, shopId, query: { category_id: categoryId, language: "vi" } });
    return r.attribute_list ?? [];
  });
}

/** Thuoc tinh nguoi dung dien ("ten/id = gia tri") -> attribute_list cua Shopee. */
async function attributeList(token: string, shopId: string, s: ListingSettings) {
  const wanted = parseAttributes(s.attributes);
  if (!wanted.length || !s.category_id) return [];
  const all = await attributesOf(token, shopId, s.category_id);
  const out: { attribute_id: number; attribute_value_list: { value_id: number; original_value_name?: string }[] }[] = [];
  for (const w of wanted) {
    const a = all.find((x) => String(x.attribute_id) === w.key || x.original_attribute_name.toLowerCase() === w.key.toLowerCase() || x.display_attribute_name?.toLowerCase() === w.key.toLowerCase());
    if (!a) throw new SocialError(`Shopee: danh mục này không có thuộc tính "${w.key}".`);
    const v = a.attribute_value_list?.find((x) => x.original_value_name.toLowerCase() === w.value.toLowerCase() || x.display_value_name?.toLowerCase() === w.value.toLowerCase());
    out.push({ attribute_id: a.attribute_id, attribute_value_list: [v ? { value_id: v.value_id } : { value_id: 0, original_value_name: w.value }] });
  }
  return out;
}

async function brandOf(token: string, shopId: string, s: ListingSettings) {
  const name = (s.brand ?? "").trim();
  if (!name || /^no ?brand$/i.test(name)) return { brand_id: 0, original_brand_name: "NoBrand" };
  type B = { brand_id: number; original_brand_name: string; display_brand_name?: string };
  const r = await call<{ brand_list?: B[] }>("GET", "/api/v2/product/get_brand_list", { token, shopId, query: { category_id: s.category_id ?? "", status: 1, offset: 0, page_size: 100 } });
  const b = r.brand_list?.find((x) => x.original_brand_name.toLowerCase() === name.toLowerCase() || x.display_brand_name?.toLowerCase() === name.toLowerCase());
  if (!b) throw new SocialError(`Shopee: thương hiệu "${name}" chưa có trong danh mục này (đăng ký thương hiệu trên Seller Centre hoặc để trống = No brand).`);
  return { brand_id: b.brand_id, original_brand_name: b.original_brand_name };
}

async function logisticsOf(token: string, shopId: string, s: ListingSettings) {
  type Ch = { logistics_channel_id: number; logistics_channel_name: string; enabled: boolean };
  const r = await call<{ logistics_channel_list?: Ch[] }>("GET", "/api/v2/logistics/get_channel_list", { token, shopId });
  const enabled = (r.logistics_channel_list ?? []).filter((c) => c.enabled);
  const chosen = s.shipping_profile_id ? enabled.filter((c) => String(c.logistics_channel_id) === s.shipping_profile_id) : enabled;
  if (!chosen.length) throw new SocialError("Shopee: shop chưa bật đơn vị vận chuyển nào (Seller Centre > Cài đặt vận chuyển).");
  return chosen.map((c) => ({ logistic_id: c.logistics_channel_id, enabled: true }));
}

export const shopee: MarketplaceAdapter = {
  platform: "shopee",
  scopes: [],

  authorizeUrl({ redirectUri, state }) {
    const path = "/api/v2/shop/auth_partner";
    const q = signed(path);
    // Shopee khong co tham so state: gan vao URL chuyen ve, Shopee them code + shop_id phia sau
    q.set("redirect", `${redirectUri}?state=${encodeURIComponent(state)}`);
    return `${host()}${path}?${q}`;
  },

  async exchangeCode({ code, query }) {
    const shopId = query.get("shop_id");
    if (!shopId) throw new SocialError("Shopee không trả về shop_id (cần ủy quyền bằng tài khoản shop, không phải tài khoản chính).");
    const t = await call<{ access_token?: string; refresh_token?: string; expire_in?: number }>("POST", "/api/v2/auth/token/get", {
      json: { code, shop_id: Number(shopId), partner_id: Number(credentials("shopee").id) },
    });
    return tokens(t, { shop_id: shopId });
  },

  async refreshTokens(refreshToken, account) {
    if (!account?.shop_id) throw new SocialError("Thiếu shop_id, hãy kết nối lại Shopee.", { auth: true });
    const t = await call<{ access_token?: string; refresh_token?: string; expire_in?: number }>("POST", "/api/v2/auth/access_token/get", {
      json: { refresh_token: refreshToken, shop_id: Number(account.shop_id), partner_id: Number(credentials("shopee").id) },
    });
    return tokens(t);
  },

  async fetchShop(token, hint) {
    const shopId = hint?.shop_id;
    if (!shopId) throw new SocialError("Thiếu shop_id từ Shopee.");
    const info = await call<{ shop_name?: string; region?: string }>("GET", "/api/v2/shop/get_shop_info", { token, shopId });
    return { name: info.shop_name ?? `Shopee ${shopId}`, shop_id: shopId, external_id: null, shop_url: `https://shopee.vn/shop/${shopId}`, currency: info.region === "VN" || !info.region ? "VND" : null };
  },

  async fetchShopData(shopId, token) {
    type Ch = { logistics_channel_id: number; logistics_channel_name: string; enabled: boolean };
    const r = await call<{ logistics_channel_list?: Ch[] }>("GET", "/api/v2/logistics/get_channel_list", { token, shopId });
    return {
      shipping_profiles: (r.logistics_channel_list ?? []).filter((c) => c.enabled).map((c): ShopOption => ({ id: String(c.logistics_channel_id), name: c.logistics_channel_name })),
      refreshed_at: now().toISOString(),
    };
  },

  async categories(account, token) {
    if (!token || !account.shop_id) return [];
    const shopId = account.shop_id;
    return cached(`shopee:cat`, async () => {
      const r = await call<{ category_list?: Category[] }>("GET", "/api/v2/product/get_category", { token, shopId, query: { language: "vi" } });
      const list = r.category_list ?? [];
      const byId = new Map(list.map((c) => [c.category_id, c]));
      const name = (c: Category) => c.display_category_name || c.original_category_name;
      const pathOf = (c: Category): string => {
        const parent = byId.get(c.parent_category_id);
        return parent ? `${pathOf(parent)} > ${name(c)}` : name(c);
      };
      // chi danh muc la (khong con con) moi dang san pham duoc
      return list.filter((c) => !c.has_children).map((c): CategoryItem => ({ id: String(c.category_id), path: pathOf(c) }));
    });
  },

  async categoryAttributes(account, token, categoryId) {
    if (!token || !account.shop_id) return [];
    const list = await attributesOf(token, account.shop_id, categoryId);
    return list.map((a): CategoryAttribute => ({
      id: String(a.attribute_id),
      name: a.display_attribute_name || a.original_attribute_name,
      required: a.is_mandatory,
      values: a.attribute_value_list?.slice(0, 30).map((v) => v.display_value_name || v.original_value_name),
    }));
  },

  demoShop() {
    return {
      shop: { name: "DemoShopeeShop", shop_id: `demo-${Date.now()}`, external_id: null, shop_url: "https://shopee.vn", currency: "VND" },
      meta: { shipping_profiles: [{ id: "50011", name: "Giao Hàng Nhanh (demo)" }, { id: "50021", name: "SPX Express (demo)" }] },
    };
  },

  validate(p, s) {
    const errs = commonValidate(p, s, { currency: CURRENCY, maxImages: MAX_IMAGES, maxOptions: 2 });
    if (s.category_id && !/^\d+$/.test(s.category_id)) errs.push("Danh mục Shopee phải là số (category_id).");
    if (title(p, s).length < 10) errs.push("Shopee: tên sản phẩm cần ít nhất 10 ký tự.");
    if (description(p, s).length < 20) errs.push("Shopee: mô tả cần ít nhất 20 ký tự.");
    if (sellableVariants(p).length > 50) errs.push("Shopee cho tối đa 50 phân loại hàng.");
    return errs;
  },

  async sync(job: SyncJob): Promise<SyncResult> {
    const { listing, product: p, settings: s, account } = job;
    const shopId = account.shop_id;
    if (!shopId) throw new SocialError("Tài khoản Shopee thiếu shop_id, hãy kết nối lại.");
    const token = await job.token();
    const progress: ListingProgress = { ...listing.progress, done: [] };
    if (s.replace_images) progress.images = {};

    // 1) Anh: tai len media space, giu image_id (khong tai lai lan sau)
    const uploaded = progress.images ?? {};
    for (const url of p.images.slice(0, MAX_IMAGES)) {
      if (uploaded[url]) continue;
      const img = await readImage(url);
      const form = new FormData();
      form.set("image", new Blob([img.data], { type: img.type }), img.name);
      const r = await call<{ image_info?: { image_id: string }; image_info_list?: { image_info?: { image_id: string } }[] }>("POST", "/api/v2/media_space/upload_image", { multipart: form });
      const id = r.image_info?.image_id ?? r.image_info_list?.[0]?.image_info?.image_id;
      if (!id) throw new SocialError("Shopee không trả về image_id khi tải ảnh.");
      uploaded[url] = id;
      progress.images = uploaded;
      await job.save({ stage: "images", progress });
    }
    const imageIds = p.images.slice(0, MAX_IMAGES).map((u) => uploaded[u]).filter(Boolean);
    progress.done!.push("images");

    const [logistics, attributes, brand] = await Promise.all([logisticsOf(token, shopId, s), attributeList(token, shopId, s), brandOf(token, shopId, s)]);
    const body = itemBody(p, s, { images: imageIds, logistics, attributes, brand });
    const hasModels = sellableVariants(p).length > 0;

    let remoteId = listing.remote_id;
    // 2) Tao moi hoac cap nhat
    if (!remoteId) {
      const r = await call<{ item_id: number }>("POST", "/api/v2/product/add_item", { token, shopId, json: body });
      remoteId = String(r.item_id);
      await job.save({ remote_id: remoteId, remote_url: `https://shopee.vn/product/${shopId}/${remoteId}`, remote_state: body.item_status, stage: "variants", progress });
      if (hasModels) await call("POST", "/api/v2/product/init_tier_variation", { token, shopId, json: { item_id: r.item_id, ...tierBody(p, s) } });
    } else {
      const { original_price: price, seller_stock: stock, ...rest } = body;
      await call("POST", "/api/v2/product/update_item", { token, shopId, json: { item_id: Number(remoteId), ...rest } });
      if (hasModels) {
        // gia / ton kho tung phan loai theo model_id hien co (khong doi cau truc phan loai sau khi da tao)
        type M = { model_id: number; model_sku?: string; tier_index: number[] };
        const ml = await call<{ model?: M[]; tier_variation?: { name: string; option_list: { option: string }[] }[] }>("GET", "/api/v2/product/get_model_list", { token, shopId, query: { item_id: remoteId } });
        const tiers = ml.tier_variation ?? [];
        const want = tierBody(p, s).model;
        const price_list: { model_id: number; original_price: number }[] = [];
        const stock_list: { model_id: number; seller_stock: { stock: number }[] }[] = [];
        for (const m of ml.model ?? []) {
          const values = m.tier_index.map((ti, i) => tiers[i]?.option_list[ti]?.option);
          const k = sellableVariants(p).findIndex((v) => values.every((val, i) => (v.values[i] ?? "-").slice(0, 30) === val));
          if (k < 0) continue;
          price_list.push({ model_id: m.model_id, original_price: want[k].original_price });
          stock_list.push({ model_id: m.model_id, seller_stock: want[k].seller_stock });
        }
        if (price_list.length) await call("POST", "/api/v2/product/update_price", { token, shopId, json: { item_id: Number(remoteId), price_list } });
        if (stock_list.length) await call("POST", "/api/v2/product/update_stock", { token, shopId, json: { item_id: Number(remoteId), stock_list } });
        if (price_list.length < want.length) progress.notice = "Shopee không cho đổi cấu trúc phân loại qua cập nhật: phân loại mới thêm trên website cần thêm tay trên Seller Centre.";
      } else {
        await call("POST", "/api/v2/product/update_price", { token, shopId, json: { item_id: Number(remoteId), price_list: [{ original_price: price }] } });
        await call("POST", "/api/v2/product/update_stock", { token, shopId, json: { item_id: Number(remoteId), stock_list: [{ seller_stock: stock }] } });
      }
    }
    progress.done!.push("item", "variants");
    return { remote_id: remoteId, remote_url: `https://shopee.vn/product/${shopId}/${remoteId}`, remote_state: body.item_status, progress };
  },

  fakeUrl(id) {
    return `https://shopee.vn/product/0/${id}`;
  },

  preview(p, s) {
    return {
      add_item: itemBody(p, s, { images: p.images.slice(0, MAX_IMAGES).map((u) => `<image_id của ${u}>`), logistics: [{ logistic_id: Number(s.shipping_profile_id) || 0, enabled: true }], attributes: parseAttributes(s.attributes), brand: { brand_id: 0, original_brand_name: s.brand || "NoBrand" } }),
      init_tier_variation: sellableVariants(p).length ? tierBody(p, s) : null,
    };
  },
};
