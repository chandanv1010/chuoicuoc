import "server-only";
import { now } from "@/lib/helpers";
import { requestJson, sleep, SocialError } from "@/modules/social/http";
import type { AccountRow } from "../accounts";
import { credentials, marketEnv } from "../config";
import type { ListingProgress } from "../listings";
import type { ListingSettings, ProductSnapshot } from "../types";
import type { CategoryAttribute, CategoryItem, MarketplaceAdapter, OAuthTokens, SyncJob, SyncResult } from "./base";
import { basePrice, cached, marketPrice, parseAttributes, publicImageUrl, safeSku, sellableVariants, variantSku } from "./common";

/**
 * Amazon Selling Partner API (https://developer-docs.amazon.com/sp-api)
 *  - Dang nhap LWA: Seller Central /apps/authorize/consent?application_id=... -> spapi_oauth_code + selling_partner_id
 *    -> POST https://api.amazon.com/auth/o2/token. Access token 1 gio; refresh token khong het han (tru khi thu hoi).
 *  - Moi request: header x-amz-access-token (khong can ky AWS SigV4 tu 10/2023).
 *  - Dang san pham: Listings Items API PUT /listings/2021-08-01/items/{sellerId}/{sku} (productType + attributes theo schema
 *    Product Type Definitions). Anh: Amazon tu tai tu URL cong khai (PUBLIC_BASE_URL phai la https that).
 *    Bien the: SKU cha (parentage_level=parent + variation_theme) + SKU con (child_parent_sku_relationship).
 *  - "Ban nhap": Amazon khong co nhap -> chay mode=VALIDATION_PREVIEW (Amazon kiem tra, chua tao listing).
 *  - AMAZON_SP_REGION na|eu|fe (mac dinh na), AMAZON_MARKETPLACE_ID (mac dinh ATVPDKIKX0DER = amazon.com),
 *    AMAZON_SP_APP_ID (amzn1.sp.solution...), AMAZON_SP_DRAFT_APP=1 khi app chua duoc duyet (version=beta).
 */

const REGION_HOST: Record<string, string> = { na: "https://sellingpartnerapi-na.amazon.com", eu: "https://sellingpartnerapi-eu.amazon.com", fe: "https://sellingpartnerapi-fe.amazon.com" };
const MARKET_SITE: Record<string, { seller: string; site: string; locale: string; currency: "USD" }> = {
  ATVPDKIKX0DER: { seller: "https://sellercentral.amazon.com", site: "https://www.amazon.com", locale: "en_US", currency: "USD" },
};
const host = () => REGION_HOST[marketEnv("AMAZON_SP_REGION") || "na"] ?? REGION_HOST.na;
const marketplaceId = () => marketEnv("AMAZON_MARKETPLACE_ID") || "ATVPDKIKX0DER";
const site = () => MARKET_SITE[marketplaceId()] ?? MARKET_SITE.ATVPDKIKX0DER;
const MAX_IMAGES = 9;

type AmzErr = { errors?: { code: string; message: string; details?: string }[] };
const isAuthErr = (status: number, body: unknown) => status === 401 || status === 403 && /Unauthorized|token/i.test(JSON.stringify((body as AmzErr)?.errors ?? ""));

async function call<T>(method: "GET" | "PUT" | "DELETE" | "PATCH", path: string, token: string, opts: { query?: Record<string, string>; json?: unknown } = {}): Promise<T> {
  const q = opts.query ? `?${new URLSearchParams(opts.query)}` : "";
  const headers: Record<string, string> = { "x-amz-access-token": token, Accept: "application/json" };
  if (opts.json !== undefined) headers["Content-Type"] = "application/json";
  try {
    const res = await requestJson<T>(`${host()}${path}${q}`, { method, headers, body: opts.json !== undefined ? JSON.stringify(opts.json) : undefined }, isAuthErr);
    await sleep(250);
    return res;
  } catch (e) {
    if (e instanceof SocialError && /errors/.test(e.message)) {
      const m = /\{.*\}$/.exec(e.message);
      const body = m ? (JSON.parse(m[0]) as AmzErr) : null;
      if (body?.errors?.length) throw new SocialError(`Amazon: ${body.errors.map((x) => `${x.code}: ${x.message}`).join("; ")}`, { auth: e.auth, retryable: e.retryable });
    }
    throw e;
  }
}

async function lwa(form: Record<string, string>): Promise<OAuthTokens> {
  const { id, secret } = credentials("amazon");
  const t = await requestJson<{ access_token?: string; refresh_token?: string; expires_in?: number }>(
    "https://api.amazon.com/auth/o2/token",
    { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ ...form, client_id: id, client_secret: secret }) },
    (s, b) => s === 400 && /invalid_grant/.test(JSON.stringify(b)),
  );
  if (!t.access_token) throw new SocialError("Amazon (LWA) không trả về access token.");
  return { access_token: t.access_token, refresh_token: t.refresh_token ?? null, expires_at: new Date(now().getTime() + (t.expires_in ?? 3600) * 1000), refresh_expires_at: null, scopes: null };
}

/* ------------------------------ Du lieu gui len ------------------------------ */

const mk = marketplaceId;
const v = (value: unknown) => [{ value, marketplace_id: mk() }];
const text = (value: string) => [{ value, language_tag: site().locale, marketplace_id: mk() }];

/** Thuoc tinh nguoi dung: "ten = gia tri" hoac "ten = [JSON nguyen ban Amazon]". */
function userAttributes(s: ListingSettings) {
  const out: Record<string, unknown> = {};
  for (const a of parseAttributes(s.attributes)) {
    if (/^[[{]/.test(a.value)) {
      try {
        out[a.key] = JSON.parse(a.value);
        continue;
      } catch {
        // khong phai JSON -> chuoi
      }
    }
    out[a.key] = v(a.value);
  }
  return out;
}

/** Thuoc tinh chung (ten, mo ta, thuong hieu, anh, ma vach). */
function commonAttrs(p: ProductSnapshot, s: ListingSettings) {
  const desc = (s.description || p.description).trim();
  const bullets = desc.split(/\n+/).map((l) => l.replace(/^[-•*\s]+/, "").trim()).filter((l) => l.length > 10).slice(0, 5);
  const images = p.images.slice(0, MAX_IMAGES).map(publicImageUrl);
  const a: Record<string, unknown> = {
    item_name: text((s.title || p.name).trim().slice(0, 200)),
    brand: text((s.brand ?? "").trim() || "Generic"),
    product_description: text(desc.slice(0, 2000)),
    ...(bullets.length ? { bullet_point: bullets.map((b) => ({ value: b.slice(0, 500), language_tag: site().locale, marketplace_id: mk() })) } : {}),
    ...(s.tags.length ? { generic_keyword: text(s.tags.join(" ").slice(0, 250)) } : {}),
    ...(s.materials.length ? { material: s.materials.slice(0, 3).map((m) => ({ value: m, language_tag: site().locale, marketplace_id: mk() })) } : {}),
    condition_type: v("new_new"),
    ...(images[0] ? { main_product_image_locator: [{ media_location: images[0], marketplace_id: mk() }] } : {}),
  };
  images.slice(1).forEach((url, i) => (a[`other_product_image_locator_${i + 1}`] = [{ media_location: url, marketplace_id: mk() }]));
  const gtin = (s.gtin ?? "").replace(/\D/g, "");
  if (gtin) a.externally_assigned_product_identifier = [{ type: gtin.length === 12 ? "upc" : "ean", value: gtin, marketplace_id: mk() }];
  else a.supplier_declared_has_product_identifier_exemption = v(true);
  return a;
}

const offer = (price: number, qty: number) => ({
  purchasable_offer: [{ currency: site().currency, our_price: [{ schedule: [{ value_with_tax: price }] }], marketplace_id: mk() }],
  fulfillment_availability: [{ fulfillment_channel_code: "DEFAULT", quantity: Math.max(0, Math.floor(qty)) }],
});

/** Ten thuoc tinh Amazon cho nhom bien the website (Color -> color, Size -> size; khac -> style). */
const amazonAttr = (option: string) => {
  const o = option.toLowerCase();
  if (/colou?r|màu/.test(o)) return "color";
  if (/size|cỡ|kích/.test(o)) return "size";
  if (/material|chất/.test(o)) return "material";
  if (/pattern|design|họa tiết|mẫu/.test(o)) return "pattern";
  return "style";
};

/** Danh sach SKU se PUT: [{sku, body}] (cha truoc, con sau). */
export function amazonListings(p: ProductSnapshot, s: ListingSettings) {
  const productType = s.category_id || "PRODUCT";
  const extra = userAttributes(s);
  const vs = sellableVariants(p);
  const base = safeSku(p.code && p.code !== "0" ? p.code : null, `CSH-${p.id}`);
  if (!vs.length) {
    return [{ sku: base, body: { productType, requirements: "LISTING", attributes: { ...commonAttrs(p, s), ...offer(marketPrice(basePrice(p), s, "USD"), p.stock), ...extra } } }];
  }
  const theme = (s.variation_theme || p.options.slice(0, 2).map(amazonAttr).join("_")).toUpperCase();
  const parentSku = `${base}-PARENT`;
  const parent = { sku: parentSku, body: { productType, requirements: "LISTING", attributes: { ...commonAttrs(p, s), parentage_level: v("parent"), variation_theme: [{ name: theme }], ...extra } } };
  const children = vs.map((variant, k) => {
    const variantAttrs: Record<string, unknown> = {};
    p.options.slice(0, 2).forEach((name, i) => (variantAttrs[amazonAttr(name)] = text(variant.values[i] ?? "-")));
    return {
      sku: variantSku(p, k),
      body: {
        productType,
        requirements: "LISTING",
        attributes: {
          ...commonAttrs(p, s),
          parentage_level: v("child"),
          child_parent_sku_relationship: [{ child_relationship_type: "variation", parent_sku: parentSku, marketplace_id: mk() }],
          variation_theme: [{ name: theme }],
          ...variantAttrs,
          ...offer(marketPrice(variant.price || basePrice(p), s, "USD"), variant.quantity),
          ...extra,
        },
      },
    };
  });
  return [parent, ...children];
}

/* ------------------------------ Adapter ------------------------------ */

type PutResult = { sku: string; status: string; submissionId?: string; issues?: { code: string; message: string; severity: string; attributeNames?: string[] }[] };

const sellerOf = (a: AccountRow) => {
  if (!a.shop_id) throw new SocialError("Thiếu seller id Amazon, hãy kết nối lại.", { auth: true });
  return a.shop_id;
};

export const amazon: MarketplaceAdapter = {
  platform: "amazon",
  scopes: [],

  authorizeUrl({ redirectUri, state }) {
    const u = new URL(`${site().seller}/apps/authorize/consent`);
    u.searchParams.set("application_id", marketEnv("AMAZON_SP_APP_ID"));
    u.searchParams.set("state", state);
    u.searchParams.set("redirect_uri", redirectUri);
    if (marketEnv("AMAZON_SP_DRAFT_APP") === "1") u.searchParams.set("version", "beta");
    return u.toString();
  },

  async exchangeCode({ code, redirectUri, query }) {
    const t = await lwa({ grant_type: "authorization_code", code, redirect_uri: redirectUri });
    return { ...t, hint: { seller_id: query.get("selling_partner_id") ?? "" } };
  },

  async refreshTokens(refreshToken) {
    return lwa({ grant_type: "refresh_token", refresh_token: refreshToken });
  },

  async fetchShop(token, hint) {
    type P = { marketplace: { id: string; name: string; countryCode: string; defaultCurrencyCode: string }; participation: { isParticipating: boolean }; storeName?: string };
    const r = await call<{ payload?: P[] }>("GET", "/sellers/v1/marketplaceParticipations", token);
    const m = r.payload?.find((x) => x.marketplace.id === marketplaceId()) ?? r.payload?.[0];
    const sellerId = hint?.seller_id;
    if (!sellerId) throw new SocialError("Amazon không trả về selling_partner_id.");
    return { name: m?.storeName || `Amazon ${sellerId}`, shop_id: sellerId, external_id: null, shop_url: `${site().site}/s?me=${sellerId}`, currency: m?.marketplace.defaultCurrencyCode ?? "USD" };
  },

  async fetchShopData() {
    return { marketplace_id: marketplaceId(), refreshed_at: now().toISOString() };
  },

  /** Tim product type theo tu khoa (Amazon can tu khoa, khong co cay danh muc day du). */
  async categories(_a, token, q) {
    if (!token || !q || q.length < 2) return [];
    return cached(`amz:pt:${q}`, async () => {
      const r = await call<{ productTypes?: { name: string; displayName?: string }[] }>("GET", "/definitions/2020-09-01/productTypes", token, { query: { marketplaceIds: marketplaceId(), keywords: q } });
      return (r.productTypes ?? []).map((x): CategoryItem => ({ id: x.name, path: `${x.displayName ?? x.name} (${x.name})` }));
    }, 3_600_000);
  },

  async categoryAttributes(_a, token, productType) {
    if (!token) return [];
    return cached(`amz:ptd:${productType}`, async () => {
      const def = await call<{ schema?: { link?: { resource: string } } }>("GET", `/definitions/2020-09-01/productTypes/${encodeURIComponent(productType)}`, token, {
        query: { marketplaceIds: marketplaceId(), requirements: "LISTING", locale: site().locale },
      });
      if (!def.schema?.link?.resource) return [];
      const schema = await requestJson<{ required?: string[]; properties?: Record<string, { title?: string; items?: { properties?: { value?: { enum?: string[] } } } }> }>(def.schema.link.resource);
      const req = new Set(schema.required ?? []);
      return Object.entries(schema.properties ?? {})
        .filter(([k]) => req.has(k))
        .map(([k, p]): CategoryAttribute => ({ id: k, name: p.title ?? k, required: true, values: p.items?.properties?.value?.enum?.slice(0, 30) }));
    });
  },

  demoShop() {
    return { shop: { name: "DemoAmazonSeller", shop_id: `demo-${Date.now()}`, external_id: null, shop_url: "https://www.amazon.com", currency: "USD" }, meta: {} };
  },

  validate(p, s) {
    const errs: string[] = [];
    if (!(s.title || p.name).trim()) errs.push("Thiếu tên sản phẩm.");
    if (!(s.description || p.description).trim()) errs.push("Thiếu mô tả sản phẩm.");
    if (!s.category_id) errs.push("Chưa chọn product type Amazon (vd HAT, TABLE_LINEN, SHIRT).");
    if (!p.images.length) errs.push("Sản phẩm chưa có ảnh.");
    if (!(basePrice(p) > 0) && !(s.price_override && s.price_override > 0)) errs.push("Giá bán phải lớn hơn 0.");
    if (p.options.length > 2) errs.push("Amazon: tối đa 2 nhóm biến thể cho mỗi variation theme.");
    const gtin = (s.gtin ?? "").replace(/\D/g, "");
    if (gtin && ![12, 13].includes(gtin.length)) errs.push("Mã vạch phải là UPC (12 số) hoặc EAN (13 số).");
    if (!/^https:\/\//.test(publicImageUrl("/x"))) errs.push("Amazon tải ảnh qua URL: PUBLIC_BASE_URL phải là https (domain thật).");
    return errs;
  },

  async sync(job: SyncJob): Promise<SyncResult> {
    const { listing, product: p, settings: s, account } = job;
    const token = await job.token();
    const seller = sellerOf(account);
    const progress: ListingProgress = { ...listing.progress, done: [] };
    const preview = s.publish !== "active";
    const items = amazonListings(p, s);
    const problems: string[] = [];
    for (const it of items) {
      const r = await call<PutResult>("PUT", `/listings/2021-08-01/items/${encodeURIComponent(seller)}/${encodeURIComponent(it.sku)}`, token, {
        query: { marketplaceIds: marketplaceId(), issueLocale: site().locale, ...(preview ? { mode: "VALIDATION_PREVIEW" } : {}) },
        json: it.body,
      });
      const errs = (r.issues ?? []).filter((x) => x.severity === "ERROR");
      if (r.status === "INVALID" || errs.length) problems.push(`${it.sku}: ${errs.map((x) => `${x.message}${x.attributeNames?.length ? ` [${x.attributeNames.join(", ")}]` : ""}`).join("; ")}`);
      progress.done!.push(it.sku);
      await job.save({ stage: "listings", progress });
    }
    if (problems.length) throw new SocialError(`Amazon từ chối dữ liệu: ${problems.join(" | ").slice(0, 1800)}`);
    if (preview) progress.notice = "Đã kiểm tra hợp lệ với Amazon (chưa tạo listing). Chọn \"Đăng bán ngay\" để tạo thật.";
    const remoteId = items[0].sku;
    return { remote_id: remoteId, remote_url: `${site().seller}/skucentral?mSku=${encodeURIComponent(remoteId)}`, remote_state: preview ? "validated" : "submitted", progress };
  },

  fakeUrl(id) {
    return `https://sellercentral.amazon.com/skucentral?mSku=${encodeURIComponent(id)}`;
  },

  preview(p, s) {
    return { "PUT /listings/2021-08-01/items/{sellerId}/{sku}": amazonListings(p, s) };
  },
};
