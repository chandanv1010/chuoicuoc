import { NextResponse } from "next/server";
import { can, getAdmin } from "@/server/auth";
import { getAccount } from "@/modules/marketplace/accounts";
import { isDryRun } from "@/modules/marketplace/config";
import { validAccessToken } from "@/modules/marketplace/oauth";
import { adapterOf } from "@/modules/marketplace/platforms";
import { MARKETPLACES, type Marketplace } from "@/modules/marketplace/types";

/** GET /ajax/marketplace/{san}/attributes?account_id=1&category_id=123 — thuoc tinh cua danh muc (bat buoc truoc). */
export async function GET(req: Request, { params }: { params: Promise<{ platform: string }> }) {
  const admin = await getAdmin();
  if (!admin || !can(admin, "marketplace.listing.update")) return NextResponse.json({ error: "unauthorized" }, { status: 403 });
  const m = (await params).platform as Marketplace;
  const adapter = MARKETPLACES.includes(m) ? adapterOf(m) : null;
  const sp = new URL(req.url).searchParams;
  const categoryId = (sp.get("category_id") ?? "").trim();
  const account = /^\d+$/.test(sp.get("account_id") ?? "") ? await getAccount(sp.get("account_id")!) : null;
  if (!adapter?.categoryAttributes || !account || account.platform !== m || !categoryId) return NextResponse.json({ items: [] });
  if (account.meta?.dry_run || isDryRun(m)) return NextResponse.json({ items: [], error: "Dry run: chưa tra được thuộc tính." });
  try {
    const token = await validAccessToken(account.id);
    const list = await adapter.categoryAttributes(account, token, categoryId);
    return NextResponse.json({ items: list.sort((a, b) => Number(b.required) - Number(a.required)).slice(0, 60) });
  } catch (e) {
    return NextResponse.json({ items: [], error: (e as Error).message }, { status: 502 });
  }
}
