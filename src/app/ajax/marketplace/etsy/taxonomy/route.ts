import { NextResponse } from "next/server";
import { can, getAdmin } from "@/server/auth";
import { hasCredentials } from "@/modules/marketplace/config";
import { etsyTaxonomy } from "@/modules/marketplace/platforms/etsy";

/** GET /ajax/marketplace/etsy/taxonomy?q=hat — tim danh muc nguoi ban Etsy (can ETSY_API_KEY). */
export async function GET(req: Request) {
  const admin = await getAdmin();
  if (!admin || !can(admin, "marketplace.listing.update")) return NextResponse.json({ error: "unauthorized" }, { status: 403 });
  if (!hasCredentials("etsy")) return NextResponse.json({ items: [], error: "Chưa có ETSY_API_KEY nên chưa tra được danh mục. Nhập số taxonomy_id thủ công." });
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().toLowerCase();
  try {
    const all = await etsyTaxonomy();
    const words = q.split(/\s+/).filter(Boolean);
    const items = (words.length ? all.filter((t) => words.every((w) => t.path.toLowerCase().includes(w))) : all).slice(0, 40);
    return NextResponse.json({ items });
  } catch (e) {
    return NextResponse.json({ items: [], error: (e as Error).message }, { status: 502 });
  }
}
