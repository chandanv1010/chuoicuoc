import { parseForm, type Input } from "@/lib/http";
import { customerOrRedirect } from "@/modules/frontend/shop/customer";
import { uploadAvatar } from "@/modules/frontend/shop/routes";

/** POST /ajax/customer/uploadAvatar — Frontend\CustomerController@uploadAvatar (middleware CustomerAuth). */
export async function POST(req: Request) {
  const customer = await customerOrRedirect(req);
  if (customer instanceof Response) return customer;
  const type = req.headers.get("content-type") ?? "";
  const input: Input = type.includes("multipart/form-data") || type.includes("application/x-www-form-urlencoded") ? parseForm(await req.formData()) : {};
  return uploadAvatar(req, input, customer);
}
