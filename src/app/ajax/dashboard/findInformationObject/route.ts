import { db } from "@/lib/db";
import { getAdmin } from "@/server/auth";
import { laravelJsonDate } from "@/modules/order/order";

/**
 * GET ajax/dashboard/findInformationObject?model=Customer&keyword=
 * Ajax\DashboardController@findInformationObject: loadClass($model)->searchInformation(
 *   name LIKE OR phone LIKE OR code LIKE). Chi model co du 3 cot nay (Customer) chay duoc;
 * model khac ban goc loi SQL/null class -> 500.
 */
const raw = (d: Date | null) => (d ? d.toISOString().slice(0, 19).replace("T", " ") : null);

export async function GET(req: Request) {
  if (!(await getAdmin())) return Response.json({ message: "Unauthenticated." }, { status: 401 });
  const sp = new URL(req.url).searchParams;
  const model = sp.get("model");
  const keyword = sp.get("keyword") ?? "";
  if (model !== "Customer") return Response.json({ message: "Server Error" }, { status: 500 });
  const rows = await db.customers.findMany({
    where: { deleted_at: null, OR: [{ name: { contains: keyword } }, { phone: { contains: keyword } }, { code: { contains: keyword } }] },
    orderBy: { id: "asc" },
  });
  // $hidden = ['password', 'remember_token']; cast email_verified_at datetime; birthday giu chuoi DB
  return Response.json(
    rows.map(({ password: _p, remember_token: _r, ...c }) => ({
      ...c,
      id: Number(c.id),
      customer_catalogue_id: Number(c.customer_catalogue_id),
      source_id: Number(c.source_id),
      birthday: raw(c.birthday),
      email_verified_at: laravelJsonDate(c.email_verified_at),
      deleted_at: laravelJsonDate(c.deleted_at),
      created_at: laravelJsonDate(c.created_at),
      updated_at: laravelJsonDate(c.updated_at),
    })),
  );
}
