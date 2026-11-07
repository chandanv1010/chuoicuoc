import { db } from "@/lib/db";
import { getAdmin } from "@/server/auth";
import { tableOf } from "@/server/models";

/** GET ajax/product/updateOrder?id=&model=&order= — Ajax\ProductController@updateOrder (dung chung moi model). */
export async function GET(req: Request) {
  if (!(await getAdmin())) return Response.json({ message: "Unauthenticated." }, { status: 401 });
  const sp = new URL(req.url).searchParams;
  const table = tableOf(sp.get("model"));
  const id = sp.get("id") ?? "";
  const order = Number.parseInt(sp.get("order") ?? "", 10);
  if (!table || !/^\d+$/.test(id) || Number.isNaN(order)) {
    return Response.json({ response: false, messages: "Cập nhật thứ tự thành công", code: 11 });
  }
  const n = await db.$executeRawUnsafe(`UPDATE \`${table}\` SET \`order\` = ? WHERE id = ?`, order, id);
  return Response.json({ response: n > 0, messages: "Cập nhật thứ tự thành công", code: n > 0 ? 10 : 11 });
}
