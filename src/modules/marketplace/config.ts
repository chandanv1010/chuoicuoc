import "server-only";
import { env, publicBaseUrl } from "@/modules/social/config";
import type { Marketplace } from "./types";

/**
 * Cau hinh tu .env (xem docs/MARKETPLACE-SETUP.md).
 * San nao chua co ma app -> chay o che do thu (dry run): ket noi tao shop thu, day san pham chi kiem tra du lieu.
 */

export function credentials(m: Marketplace) {
  switch (m) {
    case "etsy":
      return { id: env("ETSY_API_KEY"), secret: env("ETSY_SHARED_SECRET") };
    case "shopee":
      return { id: env("SHOPEE_PARTNER_ID"), secret: env("SHOPEE_PARTNER_KEY") };
    case "lazada":
      return { id: env("LAZADA_APP_KEY"), secret: env("LAZADA_APP_SECRET") };
    case "tiktok_shop":
      return { id: env("TIKTOK_SHOP_APP_KEY"), secret: env("TIKTOK_SHOP_APP_SECRET") };
    case "amazon":
      return { id: env("AMAZON_SP_CLIENT_ID"), secret: env("AMAZON_SP_CLIENT_SECRET") };
    default:
      return { id: "", secret: "" };
  }
}

export function hasCredentials(m: Marketplace) {
  const c = credentials(m);
  return Boolean(c.id && c.secret);
}

/** MARKETPLACE_DRY_RUN=1 -> moi san deu chay thu; thieu ma app -> san do chay thu. */
export function isDryRun(m: Marketplace) {
  if (env("MARKETPLACE_DRY_RUN") === "1") return true;
  return !hasCredentials(m);
}

/** URL san chuyen ve sau khi dong y (khai bao y het trong app tren san). */
export function redirectUri(m: Marketplace) {
  return `${publicBaseUrl()}/marketplace/callback/${m}`;
}

/** Gia tri .env tuy chon cua tung san (host sandbox, vung, ma ung dung...). */
export const marketEnv = env;
