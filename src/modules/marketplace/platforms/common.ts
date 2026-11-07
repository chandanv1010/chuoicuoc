import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { SocialError } from "@/modules/social/http";
import { storagePathOf } from "@/modules/social/media";
import { publicBaseUrl } from "@/modules/social/config";
import type { ListingSettings, ProductSnapshot } from "../types";

/** Ham dung chung cho adapter Shopee / Lazada / TikTok Shop / Amazon. */

const g = globalThis as unknown as { __mktCache?: Map<string, { at: number; value: unknown }> };
const cache = (g.__mktCache ??= new Map());

/** Cache trong bo nho (danh muc, thuoc tinh) — mac dinh 1 ngay. */
export async function cached<T>(key: string, load: () => Promise<T>, ttlMs = 86_400_000): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value as T;
  const value = await load();
  cache.set(key, { at: Date.now(), value });
  return value;
}

/** Doc file anh trong thu vien website. */
export async function readImage(url: string) {
  const file = storagePathOf(url);
  if (!file) throw new SocialError(`Ảnh ${url} không nằm trong thư viện website.`);
  const data = await readFile(file.abs).catch(() => null);
  if (!data) throw new SocialError(`Không đọc được ảnh ${url}.`);
  const ext = path.extname(file.abs).toLowerCase();
  const type = ext === ".png" ? "image/png" : ext === ".gif" ? "image/gif" : ext === ".webp" ? "image/webp" : "image/jpeg";
  return { data: new Uint8Array(data), type, name: path.basename(file.abs) };
}

/** URL cong khai cua anh (Amazon tai anh tu URL: can PUBLIC_BASE_URL la https that). */
export const publicImageUrl = (url: string) => (/^https?:\/\//.test(url) ? url : `${publicBaseUrl()}${url.startsWith("/") ? "" : "/"}${url}`);

/** Gia hien thi tren san: ghi de > gia website x ty gia. VND lam tron toi 1.000d. */
export function marketPrice(webPrice: number, s: ListingSettings, currency: "VND" | "USD") {
  const base = s.price_override && s.price_override > 0 ? s.price_override : webPrice * (s.fx_rate && s.fx_rate > 0 ? s.fx_rate : 1);
  return currency === "VND" ? Math.max(1000, Math.round(base / 1000) * 1000) : Math.round(base * 100) / 100;
}

/** Gia chung (san pham khong bien the) = gia thap nhat cua phien ban dang ban hoac gia san pham. */
export function basePrice(p: ProductSnapshot) {
  const prices = p.variants.filter((v) => v.enabled && v.price > 0).map((v) => v.price);
  return prices.length ? Math.min(...prices) : p.price;
}

/** Cac phien ban se dua len san (bo phien ban tat). */
export const sellableVariants = (p: ProductSnapshot) => (p.options.length ? p.variants.filter((v) => v.enabled) : []);

/** "Brand = Acme\n123 = cotton" -> [{key, value}] (key la ten hoac id thuoc tinh). */
export function parseAttributes(raw: string | undefined) {
  return (raw ?? "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return { key: l.slice(0, i).trim(), value: l.slice(i + 1).trim() };
    })
    .filter((a) => a.key && a.value);
}

/** Goi hang: bat buoc voi san VN; tra ve null neu thieu. */
export function packageOf(s: ListingSettings) {
  const w = Number(s.weight_kg);
  if (!(w > 0)) return null;
  const d = (n: number | null | undefined) => (Number(n) > 0 ? Math.ceil(Number(n)) : 0);
  return { weight_kg: Math.round(w * 1000) / 1000, length: d(s.length_cm), width: d(s.width_cm), height: d(s.height_cm) };
}

/** Kiem tra chung cho san VN: goi hang, gia > 0, anh, ty gia khi website tinh USD. */
export function commonValidate(p: ProductSnapshot, s: ListingSettings, opts: { currency: "VND" | "USD"; maxImages: number; maxOptions: number; needDims?: boolean }) {
  const errs: string[] = [];
  if (!(s.title || p.name).trim()) errs.push("Thiếu tên sản phẩm.");
  if (!(s.description || p.description).trim()) errs.push("Thiếu mô tả sản phẩm.");
  if (!s.category_id) errs.push("Chưa chọn danh mục trên sàn.");
  if (!p.images.length) errs.push("Sản phẩm chưa có ảnh.");
  if (opts.currency === "VND" && !(s.price_override && s.price_override > 0) && !(s.fx_rate && s.fx_rate > 1)) {
    errs.push("Shop tính tiền VND: nhập tỷ giá (VND cho 1 USD giá website) hoặc giá trên sàn.");
  }
  if (!(basePrice(p) > 0) && !(s.price_override && s.price_override > 0)) errs.push("Giá bán phải lớn hơn 0.");
  const pkg = packageOf(s);
  if (!pkg) errs.push("Thiếu cân nặng gói hàng (kg).");
  else if (opts.needDims && (!pkg.length || !pkg.width || !pkg.height)) errs.push("Thiếu kích thước gói hàng (dài × rộng × cao, cm).");
  if (p.options.length > opts.maxOptions) errs.push(`Sàn chỉ cho tối đa ${opts.maxOptions} nhóm biến thể, sản phẩm đang có ${p.options.length} (${p.options.join(", ")}).`);
  return errs;
}

/** Mo ta van ban -> HTML don gian (TikTok, Lazada nhan HTML). */
export const textToHtml = (s: string) =>
  s
    .split(/\n{2,}/)
    .map((para) => `<p>${para.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>")}</p>`)
    .join("");

/** SKU an toan (chu, so, - _). */
export const safeSku = (s: string | null | undefined, fallback: string) => (s ?? "").replace(/[^A-Za-z0-9\-_.]/g, "").slice(0, 50) || fallback;

/** SKU cua tung phien ban: SKU website hoac <ma SP>-<so thu tu>. */
export function variantSku(p: ProductSnapshot, i: number) {
  const v = sellableVariants(p)[i];
  const base = safeSku(p.code && p.code !== "0" ? p.code : null, `P${p.id}`);
  return safeSku(v?.sku, `${base}-${i + 1}`);
}
