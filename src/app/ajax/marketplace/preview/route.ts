import { NextResponse } from "next/server";
import { can, getAdmin } from "@/server/auth";
import { getAccount } from "@/modules/marketplace/accounts";
import { listingsOfProduct } from "@/modules/marketplace/listings";
import { adapterOf } from "@/modules/marketplace/platforms";
import { loadProduct } from "@/modules/marketplace/product-source";
import { DEFAULT_SETTINGS, type ListingSettings } from "@/modules/marketplace/types";

/**
 * GET /ajax/marketplace/preview?product_id=&account_id= — du lieu se gui len san theo lua chon da luu
 * (hoac mac dinh cua shop), kem loi kiem tra. Khong goi API san.
 */
export async function GET(req: Request) {
  const admin = await getAdmin();
  if (!admin || !can(admin, "marketplace.listing.index")) return NextResponse.json({ error: "unauthorized" }, { status: 403 });
  const sp = new URL(req.url).searchParams;
  const pid = sp.get("product_id") ?? "";
  const aid = sp.get("account_id") ?? "";
  if (!/^\d+$/.test(pid) || !/^\d+$/.test(aid)) return NextResponse.json({ error: "product_id, account_id" }, { status: 400 });
  const [account, product, listings] = await Promise.all([getAccount(aid), loadProduct(BigInt(pid)), listingsOfProduct(BigInt(pid))]);
  if (!account || !product) return NextResponse.json({ error: "not found" }, { status: 404 });
  const adapter = adapterOf(account.platform);
  if (!adapter) return NextResponse.json({ error: "unsupported" }, { status: 400 });
  const saved = listings.find((l) => l.account_id === account.id);
  const d = (account.meta?.defaults ?? {}) as Partial<ListingSettings>;
  const settings: ListingSettings = saved?.settings ?? { ...DEFAULT_SETTINGS, ...d, personalization: { ...DEFAULT_SETTINGS.personalization, ...(d.personalization ?? {}) } };
  return NextResponse.json(
    {
      platform: account.platform,
      shop: account.name,
      errors: adapter.validate(product, settings, account),
      product: { ...product, id: product.id.toString() },
      payload: adapter.preview?.(product, settings) ?? null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
