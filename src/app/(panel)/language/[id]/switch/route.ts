import { flash } from "@/lib/flash";
import { back } from "@/lib/http";
import { LOCALE_COOKIE } from "@/lib/language";
import { getAdmin } from "@/server/auth";
import { findLanguage, switchLanguage } from "@/modules/language/service";
import { absoluteUrl } from "@/lib/origin";

/**
 * GET /language/{id}/switch — LanguageController@swicthBackendLanguage:
 * LanguageService::switch($id) (cot current) roi session(['app_locale' => canonical])
 * -> o day la cookie app_locale (src/lib/language.ts doc cookie nay); redirect()->back().
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getAdmin())) {
    await flash({ error: "Bạn phải đăng nhập để sử dụng chức năng này" });
    return Response.redirect(absoluteUrl(req, "/admin"), 303);
  }
  const { id } = await params;
  if (!/^\d+$/.test(id)) return new Response("404 | Not Found", { status: 404 });
  const language = await findLanguage(BigInt(id)); // findById -> findOrFail
  if (!language) return new Response("404 | Not Found", { status: 404 });
  const res = back(req);
  try {
    await switchLanguage(language.id);
    res.cookies.set(LOCALE_COOKIE, language.canonical, { path: "/", httpOnly: true, sameSite: "lax" });
  } catch (e) {
    console.error(e);
  }
  // Laravel tra 302 cho redirect()->back()
  return new Response(null, { status: 302, headers: res.headers });
}
