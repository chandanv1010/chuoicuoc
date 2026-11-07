import { NextResponse } from "next/server";
import { flash } from "@/lib/flash";
import { absoluteUrl } from "@/lib/origin";
import { can, getAdmin } from "@/server/auth";
import { hasCredentials, redirectUri } from "@/modules/marketplace/config";
import { buildAuthorizeUrl, createDemoAccount, encodeStateCookie, stateCookieName } from "@/modules/marketplace/oauth";
import { adapterOf } from "@/modules/marketplace/platforms";
import { MARKETPLACE_INFO, MARKETPLACES, type Marketplace } from "@/modules/marketplace/types";

/**
 * GET /marketplace/connect/{etsy|...} — bat dau OAuth voi san.
 *  - Chua co ma app (.env) hoac ?demo=1: tao shop thu (dry run).
 *  - ?preview=1: tra JSON URL dong y se dung (kiem tra scope / redirect_uri / PKCE).
 */
export async function GET(req: Request, { params }: { params: Promise<{ platform: string }> }) {
  const m = (await params).platform as Marketplace;
  const admin = await getAdmin();
  if (!admin) {
    await flash({ error: "Bạn phải đăng nhập để sử dụng chức năng này" });
    return NextResponse.redirect(absoluteUrl(req, "/admin"), 303);
  }
  if (!can(admin, "marketplace.account.update")) return new Response("403 | This action is unauthorized.", { status: 403 });
  if (!MARKETPLACES.includes(m) || !adapterOf(m)) return new Response("404 | Not Found", { status: 404 });

  const sp = new URL(req.url).searchParams;
  const back = absoluteUrl(req, "/marketplace/account/index");

  if (sp.get("preview") === "1") {
    const { url } = buildAuthorizeUrl(m);
    return NextResponse.json({ platform: m, authorize_url: url, redirect_uri: redirectUri(m), scopes: adapterOf(m)!.scopes, has_credentials: hasCredentials(m) });
  }

  if (!hasCredentials(m) || sp.get("demo") === "1") {
    const name = await createDemoAccount(m, admin.id);
    await flash({ success: `Chưa có mã app ${MARKETPLACE_INFO[m].label} nên đã tạo shop thử (dry run): ${name}. Điền ${MARKETPLACE_INFO[m].env} vào .env để kết nối thật.` });
    return NextResponse.redirect(back, 303);
  }

  // Cookie state + phien admin gan voi ten mien: phai bat dau tu cung host voi redirect_uri
  const cbHost = new URL(redirectUri(m)).host;
  const reqHost = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? new URL(req.url).host;
  if (cbHost !== reqHost) {
    await flash({ error: `Hãy mở trang quản trị qua ${new URL(redirectUri(m)).origin} (PUBLIC_BASE_URL) rồi bấm Kết nối, vì sàn sẽ chuyển về ${redirectUri(m)}.` });
    return NextResponse.redirect(back, 303);
  }

  const { url, cookie } = buildAuthorizeUrl(m);
  const res = NextResponse.redirect(url, 302);
  res.cookies.set(stateCookieName(m), encodeStateCookie(cookie), {
    httpOnly: true,
    sameSite: "lax",
    secure: redirectUri(m).startsWith("https"),
    path: "/marketplace/callback",
    maxAge: 600,
  });
  return res;
}
