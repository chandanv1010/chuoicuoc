import { parseForm } from "@/lib/http";
import { unique, validate } from "@/lib/validator";
import { getAdmin } from "@/server/auth";
import { phpClean } from "@/modules/slide/php";
import { createMenuCatalogue } from "@/modules/menu/menu";

/**
 * POST ajax/menu/createCatalogue — Ajax\MenuController@createCatalogue (StoreMenuCatalogueRequest).
 * Loi validate: 422 {message, errors} nhu FormRequest khi request ajax (menu.js doc responseJSON.errors).
 */
export async function POST(req: Request) {
  if (!(await getAdmin())) return Response.json({ message: "Unauthenticated." }, { status: 401 });
  const input = phpClean(parseForm(await req.formData())) as Record<string, unknown>;
  const errors = await validate(
    input,
    { name: "required", keyword: ["required", unique("menu_catalogues", "keyword")] },
    {
      "name.required": "Bạn chưa nhập vào tên nhóm menu.",
      "keyword.required": "Bạn chưa nhập vào từ khóa của menu.",
      "keyword.unique": "Nhóm menu đã tồn tại",
    },
  );
  if (errors) {
    const all = Object.values(errors).flat();
    const more = all.length - 1;
    const message = all[0] + (more > 0 ? ` (and ${more} more error${more > 1 ? "s" : ""})` : "");
    return Response.json({ message, errors }, { status: 422 });
  }
  try {
    const data = await createMenuCatalogue(String(input.name), String(input.keyword));
    return Response.json({ code: 0, message: "Tạo nhóm menu thành công!", data });
  } catch (e) {
    // Ban goc: echo $e->getMessage(); die();
    console.error(e);
    return new Response(e instanceof Error ? e.message : "Error", { status: 200 });
  }
}
