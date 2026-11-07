import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { flash } from "@/lib/flash";
import { can, getAdmin } from "@/server/auth";
import { SocialError } from "@/modules/social/http";
import { decodeStateCookie, handleCallback, stateCookieName } from "@/modules/social/oauth";
import { OAUTH_KEYS, type OAuthKey } from "@/modules/social/types";
import { absoluteUrl } from "@/lib/origin";

/**
 * GET /social/callback/{facebook|tiktok|youtube|pinterest|x} — nen tang chuyen ve sau khi dong y.
 * Kiem tra state (cookie), doi code lay token, luu tai khoan, ve trang Tai khoan ket noi.
 */
export async function GET(req: Request, { params }: { params: Promise<{ platform: string }> }) {
  const key = (await params).platform as OAuthKey;
  if (!OAUTH_KEYS.includes(key)) return new Response("404 | Not Found", { status: 404 });
  const back = NextResponse.redirect(absoluteUrl(req, "/social/account/index"), 303);
  const fail = async (msg: string) => {
    await flash({ error: msg });
    back.cookies.delete({ name: stateCookieName(key), path: "/social/callback" });
    return back;
  };

  const admin = await getAdmin();
  if (!admin) {
    await flash({ error: "Phiên đăng nhập admin đã hết, hãy đăng nhập rồi kết nối lại." });
    return NextResponse.redirect(absoluteUrl(req, "/admin"), 303);
  }
  if (!can(admin, "social.account.update")) return new Response("403 | This action is unauthorized.", { status: 403 });

  const sp = new URL(req.url).searchParams;
  const error = sp.get("error") ?? sp.get("error_code");
  if (error) return fail(`Kết nối ${key} bị hủy hoặc lỗi: ${sp.get("error_description") ?? sp.get("error_message") ?? error}`);

  const saved = decodeStateCookie((await cookies()).get(stateCookieName(key))?.value);
  const state = sp.get("state") ?? "";
  const ok = saved && state.length === saved.state.length && timingSafeEqual(Buffer.from(state), Buffer.from(saved.state));
  if (!saved || !ok) return fail("Phiên kết nối không hợp lệ hoặc đã quá 10 phút (state không khớp). Hãy bấm Kết nối lại.");
  const code = sp.get("code");
  if (!code) return fail("Nền tảng không trả về mã xác thực (code).");

  try {
    const names = await handleCallback(key, code, saved, admin.id);
    await flash({ success: `Đã kết nối: ${names.join(", ")}` });
  } catch (e) {
    console.error("[social] callback", key, e);
    return fail(`Kết nối ${key} thất bại: ${e instanceof SocialError ? e.message : (e as Error).message}`);
  }
  back.cookies.delete({ name: stateCookieName(key), path: "/social/callback" });
  return back;
}
