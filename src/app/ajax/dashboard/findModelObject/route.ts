import { getCurrentLanguage } from "@/lib/language";
import { getAdmin } from "@/server/auth";
import { findWidgetItem } from "@/modules/widget/model-object";

/**
 * GET ajax/dashboard/findModelObject — Ajax\DashboardController@findModelObject:
 * loadClass($model)->findWidgetItem([['name','LIKE','%kw%']], $language, '<snake>_language')
 * -> JSON danh sach model (kem languages[0].pivot.name/canonical) cho widget.js.
 */
export async function GET(req: Request) {
  if (!(await getAdmin())) return Response.json({ message: "Unauthenticated." }, { status: 401 });
  const url = new URL(req.url);
  const model = url.searchParams.get("model") ?? "";
  const keyword = url.searchParams.get("keyword") ?? "";
  const language = await getCurrentLanguage();
  const rows = await findWidgetItem(model, keyword.trim(), language.id);
  // loadClass() khong tim thay repository -> goi ham tren null -> loi 500 nhu Laravel
  if (rows === null) return Response.json({ message: "Call to a member function findWidgetItem() on null" }, { status: 500 });
  return Response.json(rows);
}
