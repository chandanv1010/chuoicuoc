import "server-only";
import { writeUrl } from "@/lib/helpers";
import type { OAuthKey, Platform } from "./types";

/**
 * Cau hinh tu .env (xem .env.example + docs/SOCIAL-API-SETUP.md).
 * Kenh nao chua dien ma app thi chay o che do thu (dry run).
 */

export function env(name: string) {
  return (process.env[name] ?? "").trim();
}

export const META_GRAPH_VERSION = () => env("META_GRAPH_VERSION") || "v26.0";

/** Ma app OAuth theo key ket noi. */
export function credentials(key: OAuthKey) {
  switch (key) {
    case "facebook":
      return { id: env("META_APP_ID"), secret: env("META_APP_SECRET") };
    case "tiktok":
      return { id: env("TIKTOK_CLIENT_KEY"), secret: env("TIKTOK_CLIENT_SECRET") };
    case "youtube":
      return { id: env("GOOGLE_CLIENT_ID"), secret: env("GOOGLE_CLIENT_SECRET") };
    case "pinterest":
      return { id: env("PINTEREST_APP_ID"), secret: env("PINTEREST_APP_SECRET") };
    case "x":
      return { id: env("X_CLIENT_ID"), secret: env("X_CLIENT_SECRET") };
  }
}

export function oauthKeyOf(platform: Platform): OAuthKey {
  return platform === "instagram" ? "facebook" : platform;
}

export function hasCredentials(key: OAuthKey) {
  const c = credentials(key);
  return Boolean(c.id && c.secret);
}

/** SOCIAL_DRY_RUN=1 -> moi kenh deu thu; chua co ma app -> kenh do thu. */
export function isDryRun(platform: Platform) {
  if (env("SOCIAL_DRY_RUN") === "1") return true;
  return !hasCredentials(oauthKeyOf(platform));
}

/** Goc URL cong khai (HTTPS) de nen tang tai media va dung lam redirect_uri. */
export function publicBaseUrl() {
  return (env("PUBLIC_BASE_URL") || env("APP_URL") || "http://localhost:3010").replace(/\/+$/, "");
}

/** URL cong khai co dung duoc cho nen tang tai ve khong (HTTPS, khong phai localhost/IP noi bo). */
export function publicUrlProblem(): string | null {
  const base = publicBaseUrl();
  let u: URL;
  try {
    u = new URL(base);
  } catch {
    return `PUBLIC_BASE_URL không hợp lệ (${base}).`;
  }
  const host = u.hostname;
  if (host === "localhost" || host.endsWith(".localhost") || host === "127.0.0.1" || host === "::1" || /^(10|192\.168|172\.(1[6-9]|2\d|3[01]))\./.test(host)) {
    return `PUBLIC_BASE_URL đang là ${base} (máy nội bộ) nên nền tảng không tải được ảnh/video. Hãy đặt PUBLIC_BASE_URL là tên miền HTTPS công khai (hoặc đường hầm cloudflared) rồi khởi động lại server.`;
  }
  if (u.protocol !== "https:") return `PUBLIC_BASE_URL phải dùng HTTPS (đang là ${base}).`;
  return null;
}

export function redirectUri(key: OAuthKey) {
  return `${publicBaseUrl()}/social/callback/${key}`;
}

/** Pinterest: PINTEREST_SANDBOX=1 -> api-sandbox.pinterest.com (Trial access). */
export function pinterestApiBase() {
  return env("PINTEREST_SANDBOX") === "1" ? "https://api-sandbox.pinterest.com/v5" : "https://api.pinterest.com/v5";
}

/** TikTok: app da qua audit Direct Post chua (chua -> chi SELF_ONLY). */
export function tiktokAudited() {
  return env("TIKTOK_DIRECT_POST_AUDITED") === "1";
}

/** So WhatsApp quoc te chi gom chu so (SOCIAL_WHATSAPP), them vao noi dung goi y cho Facebook / Instagram. */
export function whatsappNumber() {
  return env("SOCIAL_WHATSAPP").replace(/\D/g, "");
}

/** Goc website cong khai dung trong link bai dang (SOCIAL_SITE_URL), rong -> APP_URL. */
export function siteBaseUrl() {
  return (env("SOCIAL_SITE_URL") || env("APP_URL") || "").replace(/\/+$/, "");
}

/** Link san pham / bai viet tren website cong khai (canonical -> https://domain/canonical.html). */
export function siteUrl(canonical: string | null | undefined) {
  const path = writeUrl(canonical, false);
  if (path === "#") return null;
  return /^https?:\/\//.test(path) ? path : `${siteBaseUrl()}/${path}`;
}
