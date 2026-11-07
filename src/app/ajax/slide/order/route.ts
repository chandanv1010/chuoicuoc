import { parseForm } from "@/lib/http";
import { getCurrentLanguage } from "@/lib/language";
import { getAdmin } from "@/server/auth";
import { phpClean } from "@/modules/slide/php";
import { updateSlideOrder } from "@/modules/slide/slide";

/**
 * POST ajax/slide/order — Ajax\SlideController@order.
 * Ban goc khong return gi -> response 200 rong.
 */
export async function POST(req: Request) {
  if (!(await getAdmin())) return Response.json({ message: "Unauthenticated." }, { status: 401 });
  const input = phpClean(parseForm(await req.formData())) as Record<string, unknown>;
  const payload = input.payload;
  const list = Array.isArray(payload) ? payload : payload && typeof payload === "object" ? Object.values(payload) : [];
  const language = await getCurrentLanguage();
  try {
    await updateSlideOrder(list as Record<string, unknown>[], language.id);
  } catch (e) {
    console.error(e);
    return new Response("Server Error", { status: 500 });
  }
  return new Response("", { status: 200, headers: { "content-type": "text/html; charset=UTF-8" } });
}
