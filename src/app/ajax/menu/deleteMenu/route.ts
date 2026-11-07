import { parseForm, str } from "@/lib/http";
import { getCurrentLanguage } from "@/lib/language";
import { getAdmin } from "@/server/auth";
import { destroyMenu } from "@/modules/menu/menu";

/**
 * POST ajax/menu/deleteMenu — Ajax\MenuController@deleteMenu -> MenuService::destroyMenu.
 * Thanh cong: 200 rong. Loi: ban goc echo thong bao loi roi die() (van 200).
 */
export async function POST(req: Request) {
  if (!(await getAdmin())) return Response.json({ message: "Unauthenticated." }, { status: 401 });
  const input = parseForm(await req.formData());
  const id = str(input, "menu_id").trim();
  const language = await getCurrentLanguage();
  try {
    if (!/^\d+$/.test(id)) throw new Error("No query results for model [App\\Models\\Menu] " + id);
    await destroyMenu(BigInt(id), language.id);
  } catch (e) {
    console.error(e);
    return new Response(e instanceof Error ? e.message : "Error", { status: 200, headers: { "content-type": "text/html; charset=UTF-8" } });
  }
  return new Response("", { status: 200, headers: { "content-type": "text/html; charset=UTF-8" } });
}
