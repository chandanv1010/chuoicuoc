import "server-only";
import { createHmac } from "node:crypto";
import { now } from "@/lib/helpers";
import { requestJson, sleep, SocialError } from "@/modules/social/http";
import type { AccountRow, ShopOption } from "../accounts";
import { credentials, marketEnv } from "../config";
import type { ListingProgress } from "../listings";
import type { ListingSettings, ProductSnapshot } from "../types";
import type { CategoryAttribute, CategoryItem, MarketplaceAdapter, OAuthTokens, SyncJob, SyncResult } from "./base";
import { basePrice, cached, commonValidate, marketPrice, packageOf, parseAttributes, readImage, sellableVariants, textToHtml, variantSku } from "./common";

/**
 * TikTok Shop Partner API, phien ban 202309 (https://partner.tiktokshop.com/docv2)
 *  - Moi request: query app_key, timestamp (giay), sign, shop_cipher (API cua shop); header x-tts-access-token.
 *  - Ky: tham so query tru sign/access_token, sap xep theo ten, chuoi = path + key1value1... + body (JSON, khong ap dung multipart);
 *    sign = HMAC-SHA256(app_secret, app_secret + chuoi + app_secret) dang hex.
 *  - Ket noi: services.tiktokshop.com/open/authorize?service_id=... -> code -> auth.tiktok-shops.com/api/v2/token/get.
 *    Sau do /authorization/202309/shops lay shop_cipher.
 *  - Day san pham: /product/202309/images/upload (tung anh -> uri) -> POST /product/202309/products (save_mode AS_DRAFT | LISTING),
 *    cap nhat PUT /product/202309/products/{id} (gui day du). Can warehouse_id (/logistics/202309/warehouses).
 *  - Loi: { code != 0, message }.
 */

const API = "https://open-api.tiktokglobalshop.com";
const AUTH = "https://auth.tiktok-shops.com";
const MAX_IMAGES = 9;

type TtBody = { code?: number; message?: string; data?: unknown; request_id?: string };
const AUTH_CODES = new Set([105001, 105002, 105003, 105005, 36004004]);
const isAuthErr = (status: number, body: unknown) => status === 401 || AUTH_CODES.has(Number((body as TtBody)?.code));

function sign(path: string, params: Record<string, string>, body: string) {
  const secret = credentials("tiktok_shop").secret;
  const str = path + Object.keys(params).filter((k) => k !== "sign" && k !== "access_token").sort().map((k) => `${k}${params[k]}`).join("") + body;
  return createHmac("sha256", secret).update(secret + str + secret).digest("hex");
}

async function call<T = Record<string, unknown>>(
  method: "GET" | "POST" | "PUT",
  path: string,
  opts: { token: string; cipher?: string; query?: Record<string, string>; json?: unknown; multipart?: FormData },
): Promise<T> {
  const params: Record<string, string> = { app_key: credentials("tiktok_shop").id, timestamp: String(Math.floor(Date.now() / 1000)), ...(opts.query ?? {}) };
  if (opts.cipher) params.shop_cipher = opts.cipher;
  const body = opts.json !== undefined ? JSON.stringify(opts.json) : "";
  params.sign = sign(path, params, body);
  const headers: Record<string, string> = { "x-tts-access-token": opts.token };
  if (body) headers["Content-Type"] = "application/json";
  const res = await requestJson<TtBody>(`${API}${path}?${new URLSearchParams(params)}`, { method, headers, body: body || opts.multipart }, isAuthErr);
  if (res.code !== undefined && res.code !== 0) {
    throw new SocialError(`TikTok Shop ${path}: ${res.code} ${res.message ?? ""}`.trim(), { auth: isAuthErr(200, res), retryable: res.code === 36009003 || /rate|too many|busy/i.test(res.message ?? "") });
  }
  await sleep(120);
  return (res.data ?? {}) as T;
}

type TtToken = { access_token?: string; access_token_expire_in?: number; refresh_token?: string; refresh_token_expire_in?: number; open_id?: string; seller_name?: string; seller_base_region?: string };

async function tokenCall(path: string, q: Record<string, string>): Promise<OAuthTokens> {
  const { id, secret } = credentials("tiktok_shop");
  const res = await requestJson<TtBody>(`${AUTH}${path}?${new URLSearchParams({ app_key: id, app_secret: secret, ...q })}`, {}, isAuthErr);
  if (res.code !== 0) throw new SocialError(`TikTok Shop token: ${res.code} ${res.message ?? ""}`, { auth: true });
  const t = (res.data ?? {}) as TtToken;
  if (!t.access_token) throw new SocialError("TikTok Shop không trả về access token.");
  // *_expire_in la moc thoi gian unix (giay), khong phai so giay con lai
  const at = (ts?: number) => (ts ? new Date(ts * 1000 + 7 * 3_600_000) : null);
  return { access_token: t.access_token, refresh_token: t.refresh_token ?? null, expires_at: at(t.access_token_expire_in), refresh_expires_at: at(t.refresh_token_expire_in), scopes: null, hint: { open_id: t.open_id ?? "", seller_name: t.seller_name ?? "", region: t.seller_base_region ?? "" } };
}

/* ------------------------------ Du lieu gui len ------------------------------ */

const currencyOf = (a: { currency: string | null }) => (a.currency === "USD" ? "USD" : "VND") as "USD" | "VND";
const title = (p: ProductSnapshot, s: ListingSettings) => (s.title || p.name).replace(/\s+/g, " ").trim().slice(0, 255);

export function productBody(p: ProductSnapshot, s: ListingSettings, ctx: { images: string[]; warehouse: string; currency: "USD" | "VND"; attributes: unknown[]; brandId?: string }) {
  const pkg = packageOf(s);
  const vs = sellableVariants(p);
  const price = (n: number) => ({ amount: String(marketPrice(n, s, ctx.currency)), currency: ctx.currency });
  const skus = vs.length
    ? vs.map((v, k) => ({
        sales_attributes: p.options.slice(0, 3).map((name, i) => ({ name, value_name: (v.values[i] ?? "-").slice(0, 50) })),
        seller_sku: variantSku(p, k),
        price: price(v.price || basePrice(p)),
        inventory: [{ warehouse_id: ctx.warehouse, quantity: Math.max(0, Math.floor(v.quantity || 0)) }],
      }))
    : [{ seller_sku: variantSku(p, 0), price: price(basePrice(p)), inventory: [{ warehouse_id: ctx.warehouse, quantity: Math.max(0, Math.floor(p.stock || 0)) }] }];
  return {
    title: title(p, s),
    description: textToHtml((s.description || p.description).trim()),
    category_id: s.category_id,
    ...(ctx.brandId ? { brand_id: ctx.brandId } : {}),
    main_images: ctx.images.map((uri) => ({ uri })),
    package_weight: { value: String(pkg?.weight_kg ?? 0), unit: "KILOGRAM" },
    ...(pkg && pkg.length && pkg.width && pkg.height ? { package_dimensions: { length: String(pkg.length), width: String(pkg.width), height: String(pkg.height), unit: "CENTIMETER" } } : {}),
    skus,
    ...(ctx.attributes.length ? { product_attributes: ctx.attributes } : {}),
    save_mode: s.publish === "active" ? "LISTING" : "AS_DRAFT",
  };
}

/* ------------------------------ Adapter ------------------------------ */

type Attr = { id: string; name: string; type: string; is_requried?: boolean; is_required?: boolean; values?: { id: string; name: string }[] };

async function attrsOf(token: string, cipher: string, categoryId: string) {
  return cached(`tts:attr:${categoryId}`, async () => (await call<{ attributes?: Attr[] }>("GET", `/product/202309/categories/${categoryId}/attributes`, { token, cipher })).attributes ?? []);
}

const cipherOf = (a: AccountRow) => {
  const c = a.meta?.shop_cipher;
  if (typeof c !== "string" || !c) throw new SocialError("Thiếu shop_cipher, hãy kết nối lại TikTok Shop.", { auth: true });
  return c;
};

export const tiktokShop: MarketplaceAdapter = {
  platform: "tiktok_shop",
  scopes: [],

  authorizeUrl({ state }) {
    // service_id: trang App cua TikTok Shop Partner Center (khac app_key)
    const u = new URL(marketEnv("TIKTOK_SHOP_AUTH_URL") || "https://services.tiktokshop.com/open/authorize");
    u.searchParams.set("service_id", marketEnv("TIKTOK_SHOP_SERVICE_ID"));
    u.searchParams.set("state", state);
    return u.toString();
  },

  async exchangeCode({ code }) {
    return tokenCall("/api/v2/token/get", { auth_code: code, grant_type: "authorized_code" });
  },

  async refreshTokens(refreshToken) {
    return tokenCall("/api/v2/token/refresh", { refresh_token: refreshToken, grant_type: "refresh_token" });
  },

  async fetchShop(token, hint) {
    type Shop = { id: string; name: string; region: string; cipher: string; code?: string; seller_type?: string };
    const r = await call<{ shops?: Shop[] }>("GET", "/authorization/202309/shops", { token });
    const shop = r.shops?.find((x) => x.region === "VN") ?? r.shops?.[0];
    if (!shop) throw new SocialError("Tài khoản TikTok Shop này chưa có shop nào đã ủy quyền.");
    // shop_cipher luu vao meta o fetchShopData (goi ngay sau buoc nay)
    return { name: shop.name || hint?.seller_name || `TikTok Shop ${shop.id}`, shop_id: shop.id, external_id: hint?.open_id || null, shop_url: null, currency: shop.region === "VN" ? "VND" : shop.region === "US" ? "USD" : null };
  },

  async fetchShopData(_shopId, token) {
    // fetchShop da tra cipher; luu vao meta de goi API cua shop
    type Shop = { id: string; cipher: string; region: string };
    const shops = (await call<{ shops?: Shop[] }>("GET", "/authorization/202309/shops", { token })).shops ?? [];
    const shop = shops.find((x) => x.id === _shopId) ?? shops[0];
    if (!shop) return {};
    type W = { id: string; name: string; type: string; is_default?: boolean; effect_status?: string };
    const w = await call<{ warehouses?: W[] }>("GET", "/logistics/202309/warehouses", { token, cipher: shop.cipher });
    return {
      shop_cipher: shop.cipher,
      region: shop.region,
      // kho hang (TikTok bat buoc khai ton kho theo kho) - dung o "Van chuyen"
      shipping_profiles: (w.warehouses ?? []).filter((x) => x.type === "SALES_WAREHOUSE").map((x): ShopOption => ({ id: x.id, name: `${x.name}${x.is_default ? " (mặc định)" : ""}` })),
      refreshed_at: now().toISOString(),
    };
  },

  async categories(account, token) {
    if (!token) return [];
    const cipher = cipherOf(account);
    return cached(`tts:cat:${account.meta?.region ?? ""}`, async () => {
      type C = { id: string; parent_id: string; local_name: string; is_leaf: boolean; permission_statuses?: string[] };
      const list = (await call<{ categories?: C[] }>("GET", "/product/202309/categories", { token, cipher, query: { locale: "vi-VN" } })).categories ?? [];
      const byId = new Map(list.map((c) => [c.id, c]));
      const pathOf = (c: C): string => {
        const parent = byId.get(c.parent_id);
        return parent ? `${pathOf(parent)} > ${c.local_name}` : c.local_name;
      };
      return list.filter((c) => c.is_leaf && !(c.permission_statuses ?? []).some((x) => /INVITE_ONLY|NON_MAIN/.test(x))).map((c): CategoryItem => ({ id: c.id, path: pathOf(c) }));
    });
  },

  async categoryAttributes(account, token, categoryId) {
    if (!token) return [];
    const list = await attrsOf(token, cipherOf(account), categoryId);
    return list
      .filter((a) => a.type === "PRODUCT_PROPERTY")
      .map((a): CategoryAttribute => ({ id: a.id, name: a.name, required: Boolean(a.is_requried ?? a.is_required), values: a.values?.slice(0, 30).map((v) => v.name) }));
  },

  demoShop() {
    return {
      shop: { name: "DemoTikTokShop", shop_id: `demo-${Date.now()}`, external_id: null, shop_url: null, currency: "VND" },
      meta: { shop_cipher: "demo", shipping_profiles: [{ id: "7000000000000000001", name: "Kho Hà Nội (mặc định) (demo)" }] },
    };
  },

  validate(p, s, account) {
    const errs = commonValidate(p, s, { currency: currencyOf(account), maxImages: MAX_IMAGES, maxOptions: 3 });
    if (!s.shipping_profile_id && !(account.meta?.shipping_profiles?.length)) errs.push("TikTok Shop: chưa có kho hàng (bấm \"Tải lại dữ liệu shop\" ở trang Tài khoản sàn).");
    if (title(p, s).length < 25) errs.push("TikTok Shop: tên sản phẩm nên dài 25–255 ký tự (ngắn quá dễ bị từ chối).");
    return errs;
  },

  async sync(job: SyncJob): Promise<SyncResult> {
    const { listing, product: p, settings: s, account } = job;
    const token = await job.token();
    const cipher = cipherOf(account);
    const progress: ListingProgress = { ...listing.progress, done: [] };
    if (s.replace_images) progress.images = {};

    const uploaded = progress.images ?? {};
    for (const url of p.images.slice(0, MAX_IMAGES)) {
      if (uploaded[url]) continue;
      const img = await readImage(url);
      const form = new FormData();
      form.set("data", new Blob([img.data], { type: img.type }), img.name);
      form.set("use_case", "MAIN_IMAGE");
      const r = await call<{ uri?: string }>("POST", "/product/202309/images/upload", { token, multipart: form });
      if (!r.uri) throw new SocialError("TikTok Shop không trả về uri ảnh.");
      uploaded[url] = r.uri;
      progress.images = uploaded;
      await job.save({ stage: "images", progress });
    }
    const images = p.images.slice(0, MAX_IMAGES).map((u) => uploaded[u]).filter(Boolean);
    progress.done!.push("images");

    const warehouse = s.shipping_profile_id || account.meta?.shipping_profiles?.[0]?.id;
    if (!warehouse) throw new SocialError("TikTok Shop: chưa chọn kho hàng.");
    // thuoc tinh san pham: "ten/id = gia tri"
    const wanted = parseAttributes(s.attributes);
    const all = wanted.length && s.category_id ? await attrsOf(token, cipher, s.category_id) : [];
    const attributes = wanted.map((w) => {
      const a = all.find((x) => x.id === w.key || x.name.toLowerCase() === w.key.toLowerCase());
      if (!a) throw new SocialError(`TikTok Shop: danh mục này không có thuộc tính "${w.key}".`);
      const v = a.values?.find((x) => x.name.toLowerCase() === w.value.toLowerCase());
      return { id: a.id, values: [v ? { id: v.id } : { name: w.value }] };
    });
    // thuong hieu: tim theo ten trong danh muc (trong = khong thuong hieu)
    let brandId: string | undefined;
    if (s.brand?.trim() && !/^no ?brand$/i.test(s.brand.trim())) {
      type B = { id: string; name: string };
      const r = await call<{ brands?: B[] }>("GET", "/product/202309/brands", { token, cipher, query: { category_id: s.category_id ?? "", brand_name: s.brand.trim(), page_size: "20" } });
      brandId = r.brands?.find((b) => b.name.toLowerCase() === s.brand!.trim().toLowerCase())?.id;
      if (!brandId) throw new SocialError(`TikTok Shop: không tìm thấy thương hiệu "${s.brand}" (đăng ký thương hiệu trên Seller Center hoặc để trống).`);
    }
    const body = productBody(p, s, { images, warehouse, currency: currencyOf(account), attributes, brandId });

    let remoteId = listing.remote_id;
    if (!remoteId) {
      const r = await call<{ product_id: string }>("POST", "/product/202309/products", { token, cipher, json: body });
      remoteId = r.product_id;
    } else {
      await call("PUT", `/product/202309/products/${remoteId}`, { token, cipher, json: body });
    }
    progress.done!.push("product");
    return { remote_id: remoteId, remote_url: `https://shop.tiktok.com/view/product/${remoteId}`, remote_state: body.save_mode === "LISTING" ? "pending_review" : "draft", progress };
  },

  fakeUrl(id) {
    return `https://shop.tiktok.com/view/product/${id}`;
  },

  preview(p, s) {
    return { "POST /product/202309/products": productBody(p, s, { images: p.images.slice(0, MAX_IMAGES).map((u) => `<uri của ${u}>`), warehouse: s.shipping_profile_id || "<warehouse_id>", currency: "VND", attributes: parseAttributes(s.attributes) }) };
  },
};
