import { NextResponse } from "next/server";
import { can, getAdmin } from "@/server/auth";
import { getAccount } from "@/modules/marketplace/accounts";
import { isDryRun } from "@/modules/marketplace/config";
import { validAccessToken } from "@/modules/marketplace/oauth";
import { adapterOf } from "@/modules/marketplace/platforms";
import { MARKETPLACES, type Marketplace } from "@/modules/marketplace/types";

/** GET /ajax/marketplace/{shopee|lazada|tiktok_shop|amazon}/taxonomy?account_id=1&q=mu — tim danh muc tren san cua shop. */
export async function GET(req: Request, { params }: { params: Promise<{ platform: string }> }) {
  const admin = await getAdmin();
  if (!admin || !can(admin, "marketplace.listing.update")) return NextResponse.json({ error: "unauthorized" }, { status: 403 });
  const m = (await params).platform as Marketplace;
  const adapter = MARKETPLACES.includes(m) ? adapterOf(m) : null;
  if (!adapter?.categories) return NextResponse.json({ items: [], error: "Sàn này chưa hỗ trợ tra danh mục." });
  const sp = new URL(req.url).searchParams;
  const account = /^\d+$/.test(sp.get("account_id") ?? "") ? await getAccount(sp.get("account_id")!) : null;
  if (!account || account.platform !== m) return NextResponse.json({ items: [], error: "Thiếu tài khoản sàn." });
  if (account.meta?.dry_run || isDryRun(m)) return NextResponse.json({ items: [], error: "Chưa có mã app (dry run) nên chưa tra được danh mục. Nhập mã danh mục thủ công." });
  const q = (sp.get("q") ?? "").trim().toLowerCase();
  try {
    const token = await validAccessToken(account.id);
    const all = await adapter.categories(account, token, q);
    const words = q.split(/\s+/).filter(Boolean);
    // Amazon da tim theo tu khoa phia san; san khac loc tai cho
    const items = (m === "amazon" || !words.length ? all : all.filter((t) => words.every((w) => t.path.toLowerCase().includes(w)))).slice(0, 40);
    return NextResponse.json({ items });
  } catch (e) {
    return NextResponse.json({ items: [], error: (e as Error).message }, { status: 502 });
  }
}
