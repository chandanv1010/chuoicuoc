import { NextResponse } from "next/server";
import { backWithErrors } from "@/lib/http";
import { validate } from "@/lib/validator";
import { expectsJson, readAjaxInput } from "@/modules/frontend/info/input";

/**
 * POST /ajax/contact/saveContact (route ajax.cart.pay) — Ajax\ContactController@create.
 * Di san website hoc bong cu, khong JS nao cua WACO goi toi.
 *
 * Giu y het hanh vi ban goc:
 * - $request->validate(): loi -> JSON 422 {message, errors} neu expectsJson(),
 *   nguoc lai redirect back + errors + old input.
 * - Qua validate: dong `Scholar::with(...)` loi vi app/Models/Scholar.php KHONG
 *   ton tai -> 500 truoc khi ghi DB. Khong ghi gi vao bang contacts.
 */
export async function POST(req: Request) {
  const input = await readAjaxInput(req);
  const errors = await validate(
    input,
    {
      name: "required|string|max:255",
      email: "required|email",
      phone: ["required", "regex:/^0[0-9]{9}$/"],
      scholarshipType: "required|integer|min:1",
      address: "required|string|max:500",
    },
    {},
    { scholarshipType: "scholarship type" }, // Str::snake() cua ten truong
  );

  if (errors) {
    if (!expectsJson(req)) return backWithErrors(req, errors, input);
    // ValidationException::summarize()
    const all = Object.values(errors).flat();
    const rest = all.length - 1;
    const message = rest > 0 ? `${all[0]} (and ${rest} more ${rest === 1 ? "error" : "errors"})` : all[0];
    return NextResponse.json({ message, errors }, { status: 422 });
  }

  const message = 'Class "App\\Models\\Scholar" not found';
  console.error(`[ajax/contact/saveContact] ${message} (giu nguyen loi cua ban Laravel)`);
  if (expectsJson(req)) return NextResponse.json({ message, exception: "Error" }, { status: 500 });
  return new Response(message, { status: 500, headers: { "content-type": "text/html; charset=UTF-8" } });
}
