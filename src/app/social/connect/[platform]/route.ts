import { NextResponse } from "next/server";
import { flash } from "@/lib/flash";
import { can, getAdmin } from "@/server/auth";
import { hasCredentials, redirectUri } from "@/modules/social/config";
import { createDemoAccounts } from "@/modules/social/demo";
import { buildAuthorizeUrl, encodeStateCookie, SCOPES, stateCookieName } from "@/modules/social/oauth";
import { OAUTH_KEYS, type OAuthKey } from "@/modules/social/types";
import { absoluteUrl } from "@/lib/origin";

/**
 * GET /social/connect/{facebook|tiktok|youtube|pinterest|x} — bat dau OAuth.
 *  - Chua co ma app (.env) hoac ?demo=1: tao tai khoan thu (dry run).
 *  - ?preview=1: tra JSON URL dang nhap se dung (kiem tra scope/redirect_uri/state/PKCE).
 */
export async function GET(req: Request, { params }: { params: Promise<{ platform: string }> }) {
  const key = (await params).platform as OAuthKey;
  const admin = await getAdmin();
  if (!admin) {
    await flash({ error: "Bạn phải đăng nhập để sử dụng chức năng này" });
    return NextResponse.redirect(absoluteUrl(req, "/admin"), 303);
  }
  if (!can(admin, "social.account.update")) return new Response("403 | This action is unauthorized.", { status: 403 });
  if (!OAUTH_KEYS.includes(key)) return new Response("404 | Not Found", { status: 404 });

  const sp = new URL(req.url).searchParams;
  const back = absoluteUrl(req, "/social/account/index");

  if (sp.get("preview") === "1") {
    const { url, cookie } = buildAuthorizeUrl(key, "MISSING_CLIENT_ID");
    const res = NextResponse.json({ platform: key, authorize_url: url, redirect_uri: redirectUri(key), scopes: SCOPES[key], has_credentials: hasCredentials(key), pkce: Boolean(cookie.verifier) });
    return res;
  }

  if (!hasCredentials(key) || sp.get("demo") === "1") {
    const names = await createDemoAccounts(key, admin.id);
    await flash({ success: `Chưa có mã app nên đã tạo tài khoản thử (dry run): ${names.join(", ")}. Điền mã app vào .env để kết nối thật.` });
    return NextResponse.redirect(back, 303);
  }

  // Cookie state + phien admin gan voi ten mien: phai bat dau tu cung host voi redirect_uri
  const cbHost = new URL(redirectUri(key)).host;
  const reqHost = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? new URL(req.url).host;
  if (cbHost !== reqHost) {
    await flash({ error: `Hãy mở trang quản trị qua ${new URL(redirectUri(key)).origin} (PUBLIC_BASE_URL) rồi bấm Kết nối, vì nền tảng sẽ chuyển về ${redirectUri(key)}.` });
    return NextResponse.redirect(back, 303);
  }

  const { url, cookie } = buildAuthorizeUrl(key);
  const res = NextResponse.redirect(url, 302);
  res.cookies.set(stateCookieName(key), encodeStateCookie(cookie), {
    httpOnly: true,
    sameSite: "lax",
    secure: url.startsWith("https") && redirectUri(key).startsWith("https"),
    path: "/social/callback",
    maxAge: 600,
  });
  return res;
}
