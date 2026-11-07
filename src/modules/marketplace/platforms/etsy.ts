import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { now } from "@/lib/helpers";
import { requestJson, sleep, SocialError } from "@/modules/social/http";
import { storagePathOf } from "@/modules/social/media";
import type { AccountMeta, AccountRow, ShopOption } from "../accounts";
import { credentials } from "../config";
import type { ListingProgress } from "../listings";
import type { ListingSettings, ProductSnapshot } from "../types";
import type { ConnectedShop, MarketplaceAdapter, OAuthTokens, SyncJob, SyncResult } from "./base";

/**
 * Etsy Open API v3 (https://developers.etsy.com/documentation, OpenAPI: https://www.etsy.com/openapi/generated/oas/3.0.0.json)
 *  - Moi request: header x-api-key = "keystring:shared_secret"; endpoint cua shop them Authorization: Bearer <token>.
 *  - OAuth 2.0 + PKCE (S256): https://www.etsy.com/oauth/connect -> POST https://openapi.etsy.com/v3/public/oauth/token
 *    access token song 1 gio, refresh token 90 ngay.
 *  - Day san pham: createDraftListing (form) -> uploadListingImage (multipart, tung anh) -> updateListingInventory (JSON,
 *    bien the dung thuoc tinh tuy chinh 513/514) -> updateListingPersonalization -> updateListing state=active (neu chon dang ngay).
 *  - Gioi han: title 140 ky tu (%, :, &, + moi ky tu mot lan); 13 tag x 20 ky tu (chu, so, khoang trang, - ' ™ © ®);
 *    13 chat lieu (chu, so, khoang trang); toi da 20 anh; so luong moi lua chon 0–999; ten gia tri bien the khong co ( ).
 */

const API = "https://openapi.etsy.com/v3/application";
const TOKEN_URL = "https://openapi.etsy.com/v3/public/oauth/token";
const SCOPES = ["listings_r", "listings_w", "shops_r", "email_r"];
/** Thuoc tinh bien the tuy chinh cua Etsy (ten do shop dat) */
const CUSTOM_PROPERTY_IDS = [513, 514];
const MAX_IMAGES = 20;
const GAP_MS = 150;

function apiKey() {
  const { id, secret } = credentials("etsy");
  return `${id}:${secret}`;
}

const etsyAuthError = (status: number, body: unknown) => {
  const e = String((body as { error?: unknown })?.error ?? "");
  return status === 401 || /invalid_token|expired|invalid_grant/i.test(e);
};

async function call<T>(token: string | null, method: string, url: string, body?: { form?: Record<string, string>; json?: unknown; multipart?: FormData }): Promise<T> {
  const headers: Record<string, string> = { "x-api-key": apiKey(), Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload: BodyInit | undefined;
  if (body?.form) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    payload = new URLSearchParams(body.form);
  } else if (body?.json !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body.json);
  } else if (body?.multipart) {
    payload = body.multipart;
  }
  const res = await requestJson<T>(url.startsWith("http") ? url : `${API}${url}`, { method, headers, body: payload }, etsyAuthError);
  await sleep(GAP_MS);
  return res;
}

function tokens(t: { access_token?: string; refresh_token?: string; expires_in?: number }): OAuthTokens {
  if (!t.access_token) throw new SocialError("Etsy không trả về access token.");
  const n = now().getTime();
  return {
    access_token: t.access_token,
    refresh_token: t.refresh_token ?? null,
    expires_at: t.expires_in ? new Date(n + t.expires_in * 1000) : null,
    refresh_expires_at: t.refresh_token ? new Date(n + 90 * 86_400_000) : null,
    scopes: SCOPES.join(" "),
  };
}

/* ------------------------------ Chuan hoa du lieu theo luat Etsy ------------------------------ */

/** Title: bo ky tu khong hop le, %, :, &, + chi giu lan dau, toi da 140. */
export function cleanTitle(s: string) {
  let out = s.replace(/[^\p{L}\p{Nd}\p{P}\p{Sm}\p{Zs}™©®]/gu, " ");
  for (const ch of ["%", ":", "&", "+"]) {
    const first = out.indexOf(ch);
    if (first >= 0) out = out.slice(0, first + 1) + out.slice(first + 1).split(ch).join(ch === "&" ? "and" : " ");
  }
  out = out.replace(/\s+/g, " ").trim();
  return out.length > 140 ? out.slice(0, 140).replace(/\s+\S*$/, "") : out;
}

export function cleanTags(tags: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    const t = raw.replace(/[^\p{L}\p{Nd}\p{Zs}\-'™©®]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 20).trim();
    if (!t || seen.has(t.toLowerCase())) continue;
    seen.add(t.toLowerCase());
    out.push(t);
    if (out.length === 13) break;
  }
  return out;
}

export function cleanMaterials(list: string[]) {
  return [...new Set(list.map((m) => m.replace(/[^\p{L}\p{Nd}\p{Zs}]/gu, " ").replace(/\s+/g, " ").trim()).filter(Boolean))].slice(0, 13);
}

const cleanValue = (s: string) => s.replace(/[()]/g, " ").replace(/\s+/g, " ").trim().slice(0, 45) || "-";
const qty = (n: number) => Math.max(0, Math.min(999, Math.floor(n || 0)));
const money = (n: number) => Math.round(n * 100) / 100;

function listingPrice(p: ProductSnapshot, s: ListingSettings) {
  if (s.price_override && s.price_override > 0) return money(s.price_override);
  const prices = p.variants.filter((v) => v.enabled && v.price > 0).map((v) => v.price);
  return money(prices.length ? Math.min(...prices) : p.price);
}

/** Body updateListingInventory: bien the -> thuoc tinh tuy chinh 513/514. */
export function inventoryBody(p: ProductSnapshot, s: ListingSettings) {
  const readiness = s.processing_profile_id ? Number(s.processing_profile_id) : undefined;
  const offering = (price: number, quantity: number, enabled: boolean) => ({
    price: money(price),
    quantity: qty(quantity),
    is_enabled: enabled && qty(quantity) > 0,
    ...(readiness ? { readiness_state_id: readiness } : {}),
  });
  if (!p.variants.length || !p.options.length) {
    const price = listingPrice(p, s);
    return { products: [{ sku: p.code && p.code !== "0" ? p.code : "", property_values: [], offerings: [offering(price, p.stock || 1, true)] }], price_on_property: [], quantity_on_property: [], sku_on_property: [] };
  }
  const props = p.options.slice(0, 2).map((name, i) => ({ id: CUSTOM_PROPERTY_IDS[i], name: cleanValue(name) }));
  const override = s.price_override && s.price_override > 0 ? s.price_override : null;
  const prices = new Set(p.variants.map((v) => v.price));
  const priceVaries = !override && prices.size > 1;
  const ids = props.map((pr) => pr.id);
  return {
    products: p.variants.map((v) => ({
      sku: v.sku ?? "",
      property_values: props.map((pr, i) => ({ property_id: pr.id, property_name: pr.name, values: [cleanValue(v.values[i] ?? "")] })),
      offerings: [offering(override ?? v.price, v.quantity, v.enabled)],
    })),
    price_on_property: priceVaries ? ids : [],
    quantity_on_property: ids,
    sku_on_property: p.variants.some((v) => v.sku) ? ids : [],
  };
}

/** Truong form cua createDraftListing / updateListing. */
export function listingFields(p: ProductSnapshot, s: ListingSettings) {
  const fields: Record<string, string> = {
    title: cleanTitle(s.title || p.name),
    description: (s.description || p.description).trim(),
    price: String(listingPrice(p, s)),
    // tong so luong; Etsy toi da 999 (so luong that tung lua chon gui qua inventory)
    quantity: String(Math.max(1, Math.min(999, p.variants.length ? p.variants.reduce((n, v) => n + (v.enabled ? qty(v.quantity) : 0), 0) : qty(p.stock || 1)))),
    who_made: s.who_made ?? "i_did",
    when_made: s.when_made ?? "made_to_order",
    is_supply: "false",
    taxonomy_id: String(s.category_id),
    type: "physical",
  };
  const tags = cleanTags(s.tags);
  const materials = cleanMaterials(s.materials);
  if (tags.length) fields.tags = tags.join(",");
  if (materials.length) fields.materials = materials.join(",");
  if (s.shipping_profile_id) fields.shipping_profile_id = s.shipping_profile_id;
  if (s.return_policy_id) fields.return_policy_id = s.return_policy_id;
  if (s.processing_profile_id) fields.readiness_state_id = s.processing_profile_id;
  return fields;
}

function optionsOf<T>(rows: T[] | undefined, map: (r: T) => ShopOption | null): ShopOption[] {
  return (rows ?? []).map(map).filter((x): x is ShopOption => Boolean(x));
}

/* ------------------------------ Adapter ------------------------------ */

export const etsy: MarketplaceAdapter = {
  platform: "etsy",
  scopes: SCOPES,

  authorizeUrl({ clientId, redirectUri, state, codeChallenge }) {
    const u = new URL("https://www.etsy.com/oauth/connect");
    u.searchParams.set("response_type", "code");
    u.searchParams.set("client_id", clientId);
    u.searchParams.set("redirect_uri", redirectUri);
    u.searchParams.set("scope", SCOPES.join(" "));
    u.searchParams.set("state", state);
    u.searchParams.set("code_challenge", codeChallenge);
    u.searchParams.set("code_challenge_method", "S256");
    return u.toString();
  },

  async exchangeCode({ code, verifier, redirectUri }) {
    const t = await requestJson<{ access_token?: string; refresh_token?: string; expires_in?: number }>(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "authorization_code", client_id: credentials("etsy").id, redirect_uri: redirectUri, code, code_verifier: verifier }),
    });
    return tokens(t);
  },

  async refreshTokens(refreshToken) {
    const t = await requestJson<{ access_token?: string; refresh_token?: string; expires_in?: number }>(
      TOKEN_URL,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ grant_type: "refresh_token", client_id: credentials("etsy").id, refresh_token: refreshToken }),
      },
      etsyAuthError,
    );
    return tokens(t);
  },

  async fetchShop(token) {
    const me = await call<{ user_id?: number; shop_id?: number }>(token, "GET", "/users/me");
    if (!me.shop_id) throw new SocialError("Tài khoản Etsy này chưa có shop.");
    const shop = await call<{ shop_id: number; shop_name?: string; title?: string; url?: string; currency_code?: string }>(token, "GET", `/shops/${me.shop_id}`);
    return { name: shop.shop_name ?? `Shop ${shop.shop_id}`, shop_id: String(shop.shop_id), external_id: me.user_id ? String(me.user_id) : null, shop_url: shop.url ?? null, currency: shop.currency_code ?? null };
  },

  async fetchShopData(shopId, token) {
    type Ship = { shipping_profile_id: number; title?: string; origin_country_iso?: string; is_deleted?: boolean };
    type Ret = { return_policy_id: number; accepts_returns?: boolean; accepts_exchanges?: boolean; return_deadline?: number | null };
    type Ready = { readiness_state_id: number; readiness_state?: string; processing_days_display_label?: string; min_processing_days?: number; max_processing_days?: number };
    const [ship, ret, ready] = await Promise.all([
      call<{ results?: Ship[] }>(token, "GET", `/shops/${shopId}/shipping-profiles`),
      call<{ results?: Ret[] }>(token, "GET", `/shops/${shopId}/policies/return`),
      call<{ results?: Ready[] }>(token, "GET", `/shops/${shopId}/readiness-state-definitions?limit=100`),
    ]);
    return {
      shipping_profiles: optionsOf(ship.results, (r) => (r.is_deleted ? null : { id: String(r.shipping_profile_id), name: r.title ?? `#${r.shipping_profile_id}`, hint: r.origin_country_iso })),
      return_policies: optionsOf(ret.results, (r) => ({
        id: String(r.return_policy_id),
        name: !r.accepts_returns && !r.accepts_exchanges ? "No returns or exchanges" : `${[r.accepts_returns && "Returns", r.accepts_exchanges && "Exchanges"].filter(Boolean).join(" & ")}${r.return_deadline ? ` within ${r.return_deadline} days` : ""}`,
      })),
      processing_profiles: optionsOf(ready.results, (r) => ({
        id: String(r.readiness_state_id),
        name: `${r.readiness_state === "made_to_order" ? "Made to order" : r.readiness_state === "ready_to_ship" ? "Ready to ship" : (r.readiness_state ?? "Profile")} (${r.processing_days_display_label ?? `${r.min_processing_days ?? "?"}-${r.max_processing_days ?? "?"} days`})`,
      })),
      refreshed_at: now().toISOString(),
    };
  },

  demoShop() {
    return {
      shop: { name: "DemoEtsyShop", shop_id: `demo-${Date.now()}`, external_id: null, shop_url: "https://www.etsy.com/shop/DemoEtsyShop", currency: "USD" },
      meta: {
        shipping_profiles: [{ id: "1001", name: "US Free Shipping - Small Items (demo)", hint: "VN" }],
        return_policies: [{ id: "2001", name: "No returns or exchanges (demo)" }],
        processing_profiles: [{ id: "3001", name: "Made to order (3-5 days) (demo)" }],
      },
    };
  },

  validate(p, s, account) {
    const errs: string[] = [];
    const meta: AccountMeta = account.meta ?? {};
    if (!cleanTitle(s.title || p.name)) errs.push("Thiếu tên sản phẩm (tiêu đề).");
    if (!(s.description || p.description).trim()) errs.push("Thiếu mô tả sản phẩm.");
    if (!(listingPrice(p, s) > 0)) errs.push("Giá bán phải lớn hơn 0.");
    if (!s.category_id || !/^\d+$/.test(s.category_id)) errs.push("Chưa chọn danh mục Etsy (taxonomy).");
    if (!s.shipping_profile_id) errs.push("Chưa chọn cài đặt vận chuyển (shipping profile).");
    if (!s.processing_profile_id && (meta.processing_profiles?.length ?? 0) > 0) errs.push("Chưa chọn thời gian làm hàng (processing profile).");
    if (s.publish === "active" && !s.return_policy_id) errs.push("Đăng bán ngay cần chọn chính sách đổi trả.");
    if (!p.images.length) errs.push("Sản phẩm chưa có ảnh.");
    if (p.options.length > 2) errs.push(`Etsy chỉ cho tối đa 2 nhóm biến thể, sản phẩm đang có ${p.options.length} (${p.options.join(", ")}).`);
    if (p.variants.length > 400) errs.push("Quá nhiều phiên bản cho một listing Etsy.");
    if (s.tags.length > 13) errs.push("Etsy cho tối đa 13 tag.");
    if (s.personalization.enabled && !s.personalization.question.trim()) errs.push("Ô cá nhân hóa cần câu hỏi (vd: Name to embroider).");
    if (s.personalization.question.length > 45) errs.push("Câu hỏi cá nhân hóa tối đa 45 ký tự.");
    if (!s.who_made || !s.when_made) errs.push("Thiếu thông tin ai làm / làm khi nào.");
    return errs;
  },

  async sync(job: SyncJob): Promise<SyncResult> {
    const { listing, product: p, settings: s, account } = job;
    const shopId = account.shop_id;
    if (!shopId) throw new SocialError("Tài khoản Etsy thiếu shop_id, hãy kết nối lại.");
    const token = await job.token();
    const progress: ListingProgress = { ...listing.progress, done: [] };
    let remoteId = listing.remote_id;
    let remoteUrl = listing.remote_url;
    let state = listing.remote_state;

    const fields = listingFields(p, s);

    type Listing = { listing_id: number; url?: string; state?: string };
    // 1) Tao ban nhap (lan dau) hoac cap nhat noi dung
    if (!remoteId) {
      const created = await call<Listing>(token, "POST", `/shops/${shopId}/listings`, { form: fields });
      remoteId = String(created.listing_id);
      remoteUrl = created.url ?? `https://www.etsy.com/listing/${remoteId}`;
      state = created.state ?? "draft";
      progress.images = {};
      await job.save({ remote_id: remoteId, remote_url: remoteUrl, remote_state: state, stage: "images", progress });
    } else {
      const upd: Record<string, string> = { ...fields };
      delete upd.price; // gia va so luong cap nhat qua inventory
      delete upd.quantity;
      const updated = await call<Listing>(token, "PATCH", `/shops/${shopId}/listings/${remoteId}`, { form: upd });
      remoteUrl = updated.url ?? remoteUrl;
      state = updated.state ?? state;
      if (s.replace_images) progress.images = {};
    }
    progress.done!.push("listing");

    // 2) Anh: chi tai anh chua co (giu id de lan thu sau khong tai trung)
    const uploaded = progress.images ?? {};
    const images = p.images.slice(0, MAX_IMAGES);
    for (let i = 0; i < images.length; i++) {
      const url = images[i];
      if (uploaded[url]) continue;
      const file = storagePathOf(url);
      if (!file) throw new SocialError(`Ảnh ${url} không nằm trong thư viện website.`);
      const data = await readFile(file.abs).catch(() => null);
      if (!data) throw new SocialError(`Không đọc được ảnh ${url}.`);
      const form = new FormData();
      form.set("image", new Blob([new Uint8Array(data)], { type: /\.png$/i.test(file.abs) ? "image/png" : /\.gif$/i.test(file.abs) ? "image/gif" : "image/jpeg" }), path.basename(file.abs));
      form.set("rank", String(i + 1));
      if (s.replace_images) form.set("overwrite", "true");
      form.set("alt_text", cleanTitle(s.title || p.name).slice(0, 250));
      const img = await call<{ listing_image_id: number }>(token, "POST", `/shops/${shopId}/listings/${remoteId}/images`, { multipart: form });
      uploaded[url] = String(img.listing_image_id);
      progress.images = uploaded;
      await job.save({ stage: "images", progress });
    }
    progress.done!.push("images");

    // 3) Gia / so luong / bien the
    await call(token, "PUT", `/listings/${remoteId}/inventory`, { json: inventoryBody(p, s) });
    progress.done!.push("inventory");
    await job.save({ stage: "personalization", progress });

    // 4) Ca nhan hoa
    if (s.personalization.enabled) {
      await call(token, "POST", `/shops/${shopId}/listings/${remoteId}/personalization`, {
        json: {
          personalization_questions: [
            {
              question_text: s.personalization.question.trim().slice(0, 45),
              question_type: "text_input",
              required: s.personalization.required,
              ...(s.personalization.instructions.trim() ? { instructions: s.personalization.instructions.trim() } : {}),
              max_allowed_characters: Math.max(1, Math.min(1024, s.personalization.max_chars || 100)),
            },
          ],
        },
      });
    } else if (listing.remote_id) {
      await call(token, "DELETE", `/shops/${shopId}/listings/${remoteId}/personalization`).catch((e: unknown) => {
        if (!(e instanceof SocialError) || !/404/.test(e.message)) throw e;
      });
    }
    progress.done!.push("personalization");

    // 5) Dang ban (ban nhap -> active). Khong tu go san pham dang ban ve nhap.
    if (s.publish === "active" && state !== "active") {
      const pub = await call<Listing>(token, "PATCH", `/shops/${shopId}/listings/${remoteId}`, { form: { state: "active" } });
      state = pub.state ?? "active";
      remoteUrl = pub.url ?? remoteUrl;
    }
    progress.done!.push("publish");
    return { remote_id: remoteId, remote_url: remoteUrl, remote_state: state, progress };
  },

  fakeUrl(id) {
    return `https://www.etsy.com/listing/${id}`;
  },

  preview(p, s) {
    return {
      createDraftListing: listingFields(p, s),
      images: p.images.slice(0, MAX_IMAGES),
      updateListingInventory: inventoryBody(p, s),
      personalization: s.personalization.enabled ? { question_text: s.personalization.question.slice(0, 45), required: s.personalization.required, max_allowed_characters: s.personalization.max_chars } : null,
      publish: s.publish,
    };
  },
};

/* ------------------------------ Danh muc (taxonomy) ------------------------------ */

type TaxNode = { id: number; name: string; children?: TaxNode[]; full_path_taxonomy_ids?: number[] };
const g = globalThis as unknown as { __etsyTaxonomy?: { at: number; flat: { id: string; path: string }[] } };

/** Danh muc nguoi ban cua Etsy (chi can API key), lam phang thanh "Accessories > Hats & Caps > ...", cache 1 ngay. */
export async function etsyTaxonomy(): Promise<{ id: string; path: string }[]> {
  if (g.__etsyTaxonomy && Date.now() - g.__etsyTaxonomy.at < 86_400_000) return g.__etsyTaxonomy.flat;
  const res = await call<{ results?: TaxNode[] }>(null, "GET", "/seller-taxonomy/nodes");
  const flat: { id: string; path: string }[] = [];
  const walk = (nodes: TaxNode[] | undefined, prefix: string) => {
    for (const n of nodes ?? []) {
      const p = prefix ? `${prefix} > ${n.name}` : n.name;
      flat.push({ id: String(n.id), path: p });
      walk(n.children, p);
    }
  };
  walk(res.results, "");
  g.__etsyTaxonomy = { at: Date.now(), flat };
  return flat;
}

export type { ConnectedShop };
