import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { now } from "@/lib/helpers";
import { validate } from "@/lib/validator";
import { readAjaxInput, val } from "@/modules/frontend/info/input";

/**
 * POST /ajax/contact/advise — Ajax\ContactController@advise +
 * Services\V1\Core\ContactService::create. Khong co JS nao cua giao dien WACO
 * goi toi (di san cua website cu) nhung van giu route y het.
 *
 * - Loi validate: HTTP 200 {status: 422, messages: {name, phone}}
 *   ($errors->first() tra '' khi truong khong loi).
 * - Thanh cong: {response: {code: 10, message}, messages: 'Đặt hàng thành công', code: 10}.
 * - Loi DB: ban goc `echo $e->getMessage(); die();` -> HTTP 200, than la chuoi loi.
 * - Khong gui mail (dong \Mail::to() trong service da bi comment).
 */
class EchoDie extends Error {}

/** Cot so (MySQL strict=false cua Laravel): chuoi khong phai so -> 0. */
function intOrNull(v: string | null): bigint | null {
  if (v === null) return null;
  const m = v.trim().match(/^[+-]?\d+/);
  return m ? BigInt(m[0]) : 0n;
}

export async function POST(req: Request) {
  const input = await readAjaxInput(req);

  const errors = await validate(
    input,
    { name: "required", phone: "required" },
    { "name.required": "Please enter your name.", "phone.required": "Please enter your phone number." },
  );
  if (errors) {
    return NextResponse.json({
      status: 422,
      messages: { name: errors.name?.[0] ?? "", phone: errors.phone?.[0] ?? "" },
    });
  }

  // ContactService::create: $payload = $request->except('_token') -> Contact::create (chi cot $fillable)
  const has = (k: string) => k in input;
  const productId = intOrNull(val(input, "product_id"));
  const postId = intOrNull(val(input, "post_id"));
  try {
    await db.$transaction(async (tx) => {
      const t = now();
      const createdAt = val(input, "created_at"); // created_at nam trong $fillable
      const data = {
        ...(has("id") && val(input, "id") !== null ? { id: intOrNull(val(input, "id"))! } : {}),
        name: val(input, "name") ?? val(input, "fullname"),
        // Eloquent chi ghi cot co trong payload; thieu email -> MySQL (khong strict) ghi ''.
        // Gui email rong (-> null) thi MySQL bao "Column 'email' cannot be null".
        email: has("email") ? val(input, "email") : "",
        phone: val(input, "phone"),
        address: val(input, "address"),
        product_id: productId,
        post_id: postId,
        publish: has("publish") ? Number(intOrNull(val(input, "publish")) ?? 0) : null,
        type: has("type") ? Number(intOrNull(val(input, "type")) ?? 0) : null,
        message: val(input, "message"),
        created_at: createdAt ? new Date(`${createdAt.replace(" ", "T")}Z`) : t,
        updated_at: t,
      };
      if (data.email === null) {
        throw new EchoDie(
          "SQLSTATE[23000]: Integrity constraint violation: 1048 Column 'email' cannot be null (Connection: mysql, SQL: insert into `contacts`)",
        );
      }
      await tx.contacts.create({ data: { ...data, email: data.email } });

      // $productRepository->getProductById($contact->product_id, 1)->name
      if (productId !== null) {
        const rows = await tx.$queryRaw<{ name: string | null }[]>`
          SELECT tb2.name FROM products JOIN product_language tb2 ON tb2.product_id = products.id
          WHERE tb2.language_id = 1 AND products.id = ${productId} AND products.deleted_at IS NULL LIMIT 1`;
        if (!rows.length) throw new EchoDie('Attempt to read property "name" on null');
      }
      if (postId !== null) {
        const rows = await tx.$queryRaw<{ name: string | null }[]>`
          SELECT tb2.name FROM posts JOIN post_language tb2 ON tb2.post_id = posts.id
          WHERE tb2.language_id = 1 AND posts.id = ${postId} AND posts.deleted_at IS NULL LIMIT 1`;
        if (!rows.length) throw new EchoDie('Attempt to read property "name" on null');
      }
    });
  } catch (e) {
    // echo $e->getMessage(); die();
    // Loi Prisma: doi sang thong bao kieu PDO, khong lo duong dan file noi bo
    const code = (e as { code?: string }).code;
    const msg =
      e instanceof EchoDie
        ? e.message
        : code === "P2003"
          ? "SQLSTATE[23000]: Integrity constraint violation: 1452 Cannot add or update a child row: a foreign key constraint fails (Connection: mysql, SQL: insert into `contacts`)"
          : `SQLSTATE[HY000]: General error (Connection: mysql, SQL: insert into \`contacts\`)`;
    if (!(e instanceof EchoDie)) console.error(e);
    return new Response(msg, { status: 200, headers: { "content-type": "text/html; charset=UTF-8" } });
  }

  return NextResponse.json({
    response: { code: 10, message: "Thanks! We will get back to you soon." },
    messages: "Order placed.",
    code: 10,
  });
}
