import "server-only";
import type { Marketplace } from "../types";
import type { MarketplaceAdapter } from "./base";
import { amazon } from "./amazon";
import { etsy } from "./etsy";
import { lazada } from "./lazada";
import { shopee } from "./shopee";
import { tiktokShop } from "./tiktok-shop";

/** San da co adapter. San moi: them file platforms/<san>.ts roi khai bao o day + bat `ready` trong types.ts. */
export const adapters: Partial<Record<Marketplace, MarketplaceAdapter>> = { etsy, shopee, lazada, tiktok_shop: tiktokShop, amazon };

export function adapterOf(m: Marketplace): MarketplaceAdapter | null {
  return adapters[m] ?? null;
}
