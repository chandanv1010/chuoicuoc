import { db } from "@/lib/db";
import { now } from "@/lib/helpers";
import { backWithErrors, parseForm, str } from "@/lib/http";
import { validate } from "@/lib/validator";

/**
 * POST ajax/order/buy/now — Ajax\ContactController@buyNow (frontend, middleware locale).
 * Luu yeu cau "mua ngay" vao bang contacts.
 */
export async function POST(req: Request) {
  const input = parseForm(await req.formData());
  // $request->validate(): khong co messages() -> thong bao mac dinh cua Laravel
  const errors = await validate(input, {
    order_name: "required|string|max:255",
    order_email: "required|email",
    order_phone: "required|regex:/^0[0-9]{9}$/",
    order_address: "required|string|max:255",
    order_title_prd: "required|string|max:255",
    order_message: "nullable|string",
  });
  if (errors) {
    const wantsJson = req.headers.get("x-requested-with") === "XMLHttpRequest" || (req.headers.get("accept") ?? "").includes("json");
    if (!wantsJson) return backWithErrors(req, errors, input);
    const all = Object.values(errors).flat();
    const more = all.length - 1;
    const message = more > 0 ? `${all[0]} (and ${more} more error${more > 1 ? "s" : ""})` : all[0];
    return Response.json({ message, errors }, { status: 422 });
  }
  try {
    const t = now();
    await db.contacts.create({
      data: {
        name: str(input, "order_name"),
        email: str(input, "order_email"),
        phone: str(input, "order_phone"),
        address: str(input, "order_address"),
        message: `
                    <div>
                        <h1>Buy now request</h1>
                        <div>Product: ${str(input, "order_title_prd")}</div>
                        <div>Message: ${str(input, "order_message")}</div>
                    </div>`,
        created_at: t,
        updated_at: t,
      },
    });
    return Response.json({ message: "Request received.", code: 200 });
  } catch (e) {
    return Response.json({ message: `Something went wrong: ${e instanceof Error ? e.message : String(e)}`, code: 500 });
  }
}
