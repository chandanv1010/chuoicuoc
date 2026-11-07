import { db } from "@/lib/db";
import { arr, parseForm, str } from "@/lib/http";
import { getAdmin } from "@/server/auth";
import { rootLocked } from "@/modules/system/site-type";
import { STATUS_FIELDS, tableOf } from "@/server/models";

/** POST ajax/dashboard/changeStatusAll — BaseService::updateStatusAll. */
export async function POST(req: Request) {
  const admin = await getAdmin();
  if (!admin) return Response.json({ message: "Unauthenticated." }, { status: 401 });
  const input = parseForm(await req.formData());
  const table = tableOf(input.model);
  const field = str(input, "field");
  let ids = arr(input, "id").filter((x) => /^\d+$/.test(x));
  // Tai khoan goc: bo khoi thao tac hang loat cua nguoi khac
  if (table === "users") ids = (await Promise.all(ids.map(async (x) => ((await rootLocked(admin.email, x)) ? null : x)))).filter((x): x is string => !!x);
  const value = Number(str(input, "value"));
  if (!table || !STATUS_FIELDS.has(field) || Number.isNaN(value)) return Response.json({ flag: false });
  if (ids.length) {
    await db.$executeRawUnsafe(
      `UPDATE \`${table}\` SET \`${field}\` = ? WHERE id IN (${ids.map(() => "?").join(",")})`,
      value,
      ...ids,
    );
  }
  return Response.json({ flag: true });
}
