import { db } from "@/lib/db";
import { now } from "@/lib/helpers";
import { parseForm, str } from "@/lib/http";
import { getAdmin } from "@/server/auth";

/**
 * POST ajax/review/changeStatus — Ajax\ReviewController@changeStatus.
 * Review::where('id', $id)->update(['status' => $status]) -> tra ve so dong bi sua.
 */
export async function POST(req: Request) {
  if (!(await getAdmin())) return Response.json({ message: "Unauthenticated." }, { status: 401 });
  const input = parseForm(await req.formData());
  const id = str(input, "id");
  const status = Number.parseInt(str(input, "status"), 10);
  if (!/^\d+$/.test(id) || Number.isNaN(status)) return Response.json(0);
  // Eloquent update() tu them updated_at
  const n = await db.$executeRaw`UPDATE reviews SET status = ${status}, updated_at = ${now()} WHERE id = ${BigInt(id)}`;
  return Response.json(n);
}
