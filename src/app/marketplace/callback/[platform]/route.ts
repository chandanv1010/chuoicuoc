import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { flash } from "@/lib/flash";
import { absoluteUrl } from "@/lib/origin";
import { can, getAdmin } from "@/server/auth";
import { SocialError } from "@/modules/social/http";
import { decodeStateCookie, handleCallback, stateCookieName } from "@/modules/marketplace/oauth";
import { adapterOf } from "@/modules/marketplace/platforms";
import { MARKETPLACES, type Marketplace } from "@/modules/marketplace/types";

/** GET /marketplace/callback/{etsy|...} — san chuyen ve sau khi dong y: kiem tra state, doi code, luu shop. */
export async function GET(req: Request, { params }: { params: Promise<{ platform: string }> }) {
  const m = (await params).platform as Marketplace;
  if (!MARKETPLACES.includes(m) || !adapterOf(m)) return new Response("404 | Not Found", { status: 404 });
  const back = NextResponse.redirect(absoluteUrl(req, "/marketplace/account/index"), 303);
  const fail = async (msg: string) => {
    await flash({ error: msg });
    back.cookies.delete({ name: stateCookieName(m), path: "/marketplace/callback" });
    return back;
  };

  const admin = await getAdmin();
  if (!admin) {
    await flash({ error: "Phiên đăng nhập admin đã hết, hãy đăng nhập rồi kết nối lại." });
    return NextResponse.redirect(absoluteUrl(req, "/admin"), 303);
  }
  if (!can(admin, "marketplace.account.update")) return new Response("403 | This action is unauthorized.", { status: 403 });

  const sp = new URL(req.url).searchParams;
  const error = sp.get("error");
  if (error) return fail(`Kết nối ${m} bị hủy hoặc lỗi: ${sp.get("error_description") ?? error}`);

  const saved = decodeStateCookie((await cookies()).get(stateCookieName(m))?.value);
  const state = sp.get("state") ?? "";
  const ok = saved && ((!state && adapterOf(m)!.stateOptional) || (state.length === saved.state.length && timingSafeEqual(Buffer.from(state), Buffer.from(saved.state))));
  if (!saved || !ok) return fail("Phiên kết nối không hợp lệ hoặc đã quá 10 phút (state không khớp). Hãy bấm Kết nối lại.");
  // Amazon tra spapi_oauth_code; cac san khac tra code
  const code = sp.get("code") ?? sp.get("spapi_oauth_code");
  if (!code) return fail("Sàn không trả về mã xác thực (code).");

  try {
    const name = await handleCallback(m, code, saved, admin.id, sp);
    await flash({ success: `Đã kết nối shop ${name}.` });
  } catch (e) {
    console.error("[marketplace] callback", m, e);
    return fail(`Kết nối ${m} thất bại: ${e instanceof SocialError ? e.message : (e as Error).message}`);
  }
  back.cookies.delete({ name: stateCookieName(m), path: "/marketplace/callback" });
  return back;
}
