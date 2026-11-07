import "server-only";
import { createHmac } from "node:crypto";
import { now } from "@/lib/helpers";
import { requestJson, sleep, SocialError } from "@/modules/social/http";
import { credentials, marketEnv } from "../config";
import type { ListingProgress } from "../listings";
import type { ListingSettings, ProductSnapshot } from "../types";
import type { CategoryAttribute, CategoryItem, MarketplaceAdapter, OAuthTokens, SyncJob, SyncResult } from "./base";
import { basePrice, cached, commonValidate, marketPrice, packageOf, parseAttributes, readImage, sellableVariants, textToHtml, variantSku } from "./common";

/**
 * Lazada Open Platform (https://open.lazada.com/apps/doc/api)
 *  - Ky: sap xep tham so theo ten, chuoi = api_path + key1value1key2value2...; sign = HMAC-SHA256(app_secret) dang HEX IN HOA.
 *    Tham so chung: app_key, timestamp (ms), sign_method=sha256, access_token, sign.
 *  - Ket noi: https://auth.lazada.com/oauth/authorize -> code -> /auth/token/create (auth.lazada.com/rest).
 *    Access token ~30 ngay, refresh token ~180 ngay (/auth/token/refresh).
 *  - Day san pham: /image/upload (tung anh, tra URL anh tren Lazada) -> /product/create (payload JSON {Request:{Product}}),
 *    cap nhat /product/update + /product/price_quantity/update. San pham moi qua kiem duyet (QC) cua Lazada.
 *  - Loi tra HTTP 200 kem { code != "0", message }.
 *  - LAZADA_API_HOST mac dinh https://api.lazada.vn/rest (Viet Nam).
 */

const API = () => marketEnv("LAZADA_API_HOST") || "https://api.lazada.vn/rest";
const AUTH_API = "https://auth.lazada.com/rest";
const MAX_IMAGES = 8;
const CURRENCY = "VND" as const;

type LzBody = { code?: string; message?: string; type?: string; data?: unknown; request_id?: string; [k: string]: unknown };
const isAuthErr = (_s: number, body: unknown) => /IllegalAccessToken|AccessTokenExpired|InvalidToken|IllegalRefreshToken/i.test(String((body as LzBody)?.code ?? ""));

function sign(apiPath: string, params: Record<string, string>) {
  const str = apiPath + Object.keys(params).sort().map((k) => `${k}${params[k]}`).join("");
  return createHmac("sha256", credentials("lazada").secret).update(str).digest("hex").toUpperCase();
}

async function call<T = Record<string, unknown>>(
  method: "GET" | "POST",
  apiPath: string,
  opts: { token?: string; params?: Record<string, string>; file?: { field: string; blob: Blob; name: string }; base?: string } = {},
): Promise<T> {
  const params: Record<string, string> = { app_key: credentials("lazada").id, timestamp: String(Date.now()), sign_method: "sha256", ...(opts.params ?? {}) };
  if (opts.token) params.access_token = opts.token;
  params.sign = sign(apiPath, params);
  const url = `${opts.base ?? API()}${apiPath}`;
  let res: LzBody;
  if (method === "GET") {
    res = await requestJson<LzBody>(`${url}?${new URLSearchParams(params)}`, {}, isAuthErr);
  } else if (opts.file) {
    // file khong nam trong chu ky; tham so chung o query
    const form = new FormData();
    form.set(opts.file.field, opts.file.blob, opts.file.name);
    res = await requestJson<LzBody>(`${url}?${new URLSearchParams(params)}`, { method: "POST", body: form }, isAuthErr);
  } else {
    res = await requestJson<LzBody>(url, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" }, body: new URLSearchParams(params) }, isAuthErr);
  }
  if (res.code && res.code !== "0") {
    const detail = Array.isArray((res as { detail?: unknown[] }).detail) ? ` ${JSON.stringify((res as { detail?: unknown[] }).detail).slice(0, 600)}` : "";
    throw new SocialError(`Lazada ${apiPath}: ${res.code} ${res.message ?? ""}${detail}`.trim(), { auth: isAuthErr(200, res), retryable: /ApiCallLimit|ServiceTimeout|SYSTEM_ERROR/i.test(res.code) });
  }
  await sleep(150);
  return (res.data ?? res) as T;
}

type LzToken = { access_token?: string; refresh_token?: string; expires_in?: number; refresh_expires_in?: number; account?: string; country?: string; country_user_info?: { country: string; seller_id: string; user_id: string; short_code?: string }[] };

function tokens(t: LzToken): OAuthTokens {
  if (!t.access_token) throw new SocialError("Lazada không trả về access token.");
  const n = now().getTime();
  const vn = t.country_user_info?.find((c) => c.country === "vn") ?? t.country_user_info?.[0];
  return {
    access_token: t.access_token,
    refresh_token: t.refresh_token ?? null,
    expires_at: t.expires_in ? new Date(n + t.expires_in * 1000) : null,
    refresh_expires_at: t.refresh_expires_in ? new Date(n + t.refresh_expires_in * 1000) : null,
    scopes: null,
    hint: { seller_id: vn?.seller_id ?? "", account: t.account ?? "", short_code: vn?.short_code ?? "" },
  };
}

/* ------------------------------ Du lieu gui len ------------------------------ */

const title = (p: ProductSnapshot, s: ListingSettings) => (s.title || p.name).replace(/\s+/g, " ").trim().slice(0, 255);

/** Product cho /product/create va /product/update (images: URL anh tren Lazada). */
export function productBody(p: ProductSnapshot, s: ListingSettings, images: string[], itemId?: string) {
  const pkg = packageOf(s);
  const pkgFields = {
    package_weight: String(pkg?.weight_kg ?? 0),
    package_length: String(pkg?.length || 1),
    package_width: String(pkg?.width || 1),
    package_height: String(pkg?.height || 1),
  };
  const attrs: Record<string, string> = {
    name: title(p, s),
    description: textToHtml((s.description || p.description).trim()),
    brand: (s.brand ?? "").trim() || "No Brand",
  };
  for (const a of parseAttributes(s.attributes)) attrs[a.key] = a.value;
  const vs = sellableVariants(p);
  const options = p.options.slice(0, 3);
  const variation = vs.length
    ? Object.fromEntries(
        options.map((name, i) => [
          `Variation${i + 1}`,
          { name, hasImage: false, customize: true, options: { option: [...new Set(vs.map((v) => v.values[i] ?? "-"))] } },
        ]),
      )
    : undefined;
  const skus = vs.length
    ? vs.map((v, k) => ({
        SellerSku: variantSku(p, k),
        quantity: String(Math.max(0, Math.floor(v.quantity || 0))),
        price: String(marketPrice(v.price || basePrice(p), s, CURRENCY)),
        saleProp: Object.fromEntries(options.map((name, i) => [name, v.values[i] ?? "-"])),
        ...pkgFields,
      }))
    : [{ SellerSku: variantSku(p, 0), quantity: String(Math.max(0, Math.floor(p.stock || 0))), price: String(marketPrice(basePrice(p), s, CURRENCY)), ...pkgFields }];
  return {
    Request: {
      Product: {
        ...(itemId ? { ItemId: itemId } : {}),
        PrimaryCategory: s.category_id,
        Images: { Image: images },
        Attributes: attrs,
        ...(variation ? { variation } : {}),
        Skus: { Sku: skus },
      },
    },
  };
}

/* ------------------------------ Adapter ------------------------------ */

type LzCat = { category_id: number; name: string; leaf: boolean; children?: LzCat[] };

export const lazada: MarketplaceAdapter = {
  platform: "lazada",
  scopes: [],
  stateOptional: true,

  authorizeUrl({ clientId, redirectUri, state }) {
    const u = new URL("https://auth.lazada.com/oauth/authorize");
    u.searchParams.set("response_type", "code");
    u.searchParams.set("force_auth", "true");
    u.searchParams.set("redirect_uri", redirectUri);
    u.searchParams.set("client_id", clientId);
    u.searchParams.set("country", "vn");
    u.searchParams.set("state", state);
    return u.toString();
  },

  async exchangeCode({ code }) {
    return tokens(await call<LzToken>("POST", "/auth/token/create", { params: { code }, base: AUTH_API }).then((r) => r as LzToken));
  },

  async refreshTokens(refreshToken) {
    return tokens(await call<LzToken>("POST", "/auth/token/refresh", { params: { refresh_token: refreshToken }, base: AUTH_API }));
  },

  async fetchShop(token, hint) {
    const seller = await call<{ name?: string; seller_id?: number | string; short_code?: string; email?: string }>("GET", "/seller/get", { token });
    const sellerId = String(seller.seller_id ?? hint?.seller_id ?? "");
    return { name: seller.name ?? `Lazada ${sellerId}`, shop_id: sellerId, external_id: hint?.account || seller.email || null, shop_url: seller.short_code ? `https://www.lazada.vn/shop/${seller.short_code}` : null, currency: "VND" };
  },

  async fetchShopData() {
    // Lazada khong can chon van chuyen o tung san pham (theo cai dat shop + kich thuoc goi hang)
    return { refreshed_at: now().toISOString() };
  },

  async categories() {
    return cached("lazada:cat", async () => {
      const tree = await call<LzCat[]>("GET", "/category/tree/get", { params: { language_code: "vi_VN" } });
      const out: CategoryItem[] = [];
      const walk = (nodes: LzCat[] | undefined, prefix: string) => {
        for (const n of nodes ?? []) {
          const path = prefix ? `${prefix} > ${n.name}` : n.name;
          if (n.leaf) out.push({ id: String(n.category_id), path });
          walk(n.children, path);
        }
      };
      walk(tree, "");
      return out;
    });
  },

  async categoryAttributes(_a, _t, categoryId) {
    type A = { name: string; label?: string; is_mandatory?: number; attribute_type?: string; is_sale_prop?: number; options?: { name: string }[] };
    const list = await cached(`lazada:attr:${categoryId}`, () => call<A[]>("GET", "/category/attributes/get", { params: { primary_category_id: categoryId, language_code: "vi_VN" } }));
    return list
      .filter((a) => a.attribute_type !== "sku" || a.is_mandatory)
      .map((a): CategoryAttribute => ({ id: a.name, name: a.label ?? a.name, required: a.is_mandatory === 1, values: a.options?.slice(0, 30).map((o) => o.name) }));
  },

  demoShop() {
    return { shop: { name: "DemoLazadaShop", shop_id: `demo-${Date.now()}`, external_id: null, shop_url: "https://www.lazada.vn", currency: "VND" }, meta: {} };
  },

  validate(p, s) {
    const errs = commonValidate(p, s, { currency: CURRENCY, maxImages: MAX_IMAGES, maxOptions: 3, needDims: true });
    if (s.category_id && !/^\d+$/.test(s.category_id)) errs.push("Danh mục Lazada phải là số (primary_category_id).");
    return errs;
  },

  async sync(job: SyncJob): Promise<SyncResult> {
    const { listing, product: p, settings: s } = job;
    const token = await job.token();
    const progress: ListingProgress = { ...listing.progress, done: [] };
    if (s.replace_images) progress.images = {};

    const uploaded = progress.images ?? {};
    for (const url of p.images.slice(0, MAX_IMAGES)) {
      if (uploaded[url]) continue;
      const img = await readImage(url);
      const r = await call<{ image?: { url: string } }>("POST", "/image/upload", { token, file: { field: "image", blob: new Blob([img.data], { type: img.type }), name: img.name } });
      if (!r.image?.url) throw new SocialError("Lazada không trả về URL ảnh.");
      uploaded[url] = r.image.url;
      progress.images = uploaded;
      await job.save({ stage: "images", progress });
    }
    const images = p.images.slice(0, MAX_IMAGES).map((u) => uploaded[u]).filter(Boolean);
    progress.done!.push("images");

    let remoteId = listing.remote_id;
    if (!remoteId) {
      const r = await call<{ item_id: number | string }>("POST", "/product/create", { token, params: { payload: JSON.stringify(productBody(p, s, images)) } });
      remoteId = String(r.item_id);
    } else {
      await call("POST", "/product/update", { token, params: { payload: JSON.stringify(productBody(p, s, images, remoteId)) } });
    }
    const remoteUrl = `https://www.lazada.vn/products/-i${remoteId}.html`;
    progress.done!.push("product");
    // Lazada khong co "nhap": san pham tao xong vao kiem duyet; chon nhap -> tat ban (deactivate) ngay sau khi tao
    let state = "pending_qc";
    if (s.publish === "draft") {
      await call("POST", "/product/deactivate", { token, params: { apiRequestBody: JSON.stringify({ Request: { Product: { ItemId: remoteId } } }) } }).catch((e: unknown) => {
        progress.notice = `Không tắt được sản phẩm sau khi tạo: ${(e as Error).message}`;
      });
      state = "inactive";
    }
    return { remote_id: remoteId, remote_url: remoteUrl, remote_state: state, progress };
  },

  fakeUrl(id) {
    return `https://www.lazada.vn/products/-i${id}.html`;
  },

  preview(p, s) {
    return { "product/create payload": productBody(p, s, p.images.slice(0, MAX_IMAGES).map((u) => `<URL Lazada của ${u}>`)) };
  },
};
