import { db } from "@/lib/db";
import { parseForm, str } from "@/lib/http";
import { getAdmin } from "@/server/auth";
import { rootLocked } from "@/modules/system/site-type";
import { STATUS_FIELDS, tableOf } from "@/server/models";

/** POST ajax/dashboard/changeStatus — BaseService::updateStatus: dao 1 <-> 2. */
export async function POST(req: Request) {
  const admin = await getAdmin();
  if (!admin) return Response.json({ message: "Unauthenticated." }, { status: 401 });
  const input = parseForm(await req.formData());
  const table = tableOf(input.model);
  const field = str(input, "field");
  const id = str(input, "modelId");
  if (!table || !STATUS_FIELDS.has(field) || !/^\d+$/.test(id)) return Response.json({ flag: false });
  // Tai khoan goc: chi chinh no doi duoc tinh trang
  if (table === "users" && (await rootLocked(admin.email, id))) return Response.json({ flag: false });
  const value = str(input, "value") === "1" ? 2 : 1;
  await db.$executeRawUnsafe(`UPDATE \`${table}\` SET \`${field}\` = ? WHERE id = ?`, value, id);
  return Response.json({ flag: true });
}
