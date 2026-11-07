import { parseForm, str } from "@/lib/http";
import { getAdmin } from "@/server/auth";
import { updateOrder } from "@/modules/order/order";

/** POST ajax/order/update — Ajax\OrderController@update (id, payload[field]=value). */
export async function POST(req: Request) {
  if (!(await getAdmin())) return Response.json({ message: "Unauthenticated." }, { status: 401 });
  const input = parseForm(await req.formData());
  const payload = input.payload && typeof input.payload === "object" && !Array.isArray(input.payload) ? (input.payload as Record<string, unknown>) : {};
  return Response.json(await updateOrder(str(input, "id"), payload));
}
