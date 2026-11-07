import { parseForm, str } from "@/lib/http";
import { getCurrentLanguage } from "@/lib/language";
import { getAdmin } from "@/server/auth";
import { dragUpdate } from "@/modules/menu/menu";

/**
 * POST ajax/menu/drag — Ajax\MenuController@drag: luu thu tu/cha sau khi keo tha nestable.
 * Ban goc khong tra ve gi (200 rong); id khong ton tai -> findOrFail -> 404.
 */
export async function POST(req: Request) {
  if (!(await getAdmin())) return Response.json({ message: "Unauthenticated." }, { status: 401 });
  const input = parseForm(await req.formData());
  let json: unknown = null;
  try {
    json = JSON.parse(str(input, "json"));
  } catch {
    json = null;
  }
  const language = await getCurrentLanguage();
  try {
    // json_decode loi -> null -> dragUpdate(array) TypeError 500 ben Laravel
    if (json === null || typeof json !== "object") return new Response("Server Error", { status: 500 });
    await dragUpdate(json, language.id);
  } catch (e) {
    console.error(e);
    const notFound = e instanceof Error && e.message === "ModelNotFound";
    return new Response(notFound ? "Not Found" : "Server Error", { status: notFound ? 404 : 500 });
  }
  return new Response("", { status: 200, headers: { "content-type": "text/html; charset=UTF-8" } });
}
