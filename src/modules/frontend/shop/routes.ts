import "server-only";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { db } from "@/lib/db";
import { now } from "@/lib/helpers";
import { back, backWithErrors, redirectWith, type Input } from "@/lib/http";
import { flash } from "@/lib/flash";
import { loginAs, logoutGuard } from "@/lib/session";
import { unique, validate, type RuleFn } from "@/lib/validator";
import { checkPassword, hashPassword } from "@/modules/auth/routes";
import { laravelJson } from "@/modules/product/ajax";
import { laravelInput } from "@/modules/promotion/php";
import { STORAGE_DIR } from "@/server/media";
import type { FormRoute } from "@/server/routes";
import { placeOrder } from "./cart";
import { currentCustomer, customerOrRedirect, type Customer } from "./customer";
import { url } from "@/modules/frontend/helpers";
import { PhpException } from "./php";
import { shopSession } from "./session";

/**
 * Form POST cua website (khach hang + gio hang), thay:
 *   - Frontend\AuthController@login/registerAccount/logout
 *   - Frontend\CustomerController@updateProfile/updatePassword/uploadAvatar
 *   - Frontend\CartController@store/storePay
 */

/** withInput(): Laravel khong flash cac truong mat khau ($dontFlash). */
function withoutPasswords(input: Input): Input {
  const out = { ...input };
  for (const k of ["password", "password_confirmation", "current_password"]) delete out[k];
  return out;
}

/**
 * Rule regex:... dang mang cua Laravel: validator chung tach chuoi rule theo "|"
 * nen pattern co dau | (0[3|5|7|8|9]) phai viet thanh RuleFn.
 */
function regex(re: RegExp): RuleFn {
  return ({ value }) => (value === null || value === undefined || value === "" ? null : re.test(String(value)) ? null : "regex");
}

/** So dien thoai: 7-15 chu so, cho phep +, khoang trang, -, (), . (US: (555) 123-4567, VN: 0912345678). */
const PHONE_RE = /^\+?(?=(?:\D*\d){7,15}\D*$)[0-9 ().-]+$/;

/** Response cua `echo $e->getMessage(); die();` */
function phpDie(e: unknown, withCode = false) {
  if (e instanceof PhpException) return new Response(withCode ? `${e.message}${e.code}` : e.message, { headers: { "content-type": "text/html; charset=UTF-8" } });
  throw e;
}

/* --------------------------------- Dang nhap --------------------------------- */

/** POST /login.html — AuthController@login */
async function login({ req, input: raw }: { req: Request; input: Input }) {
  const input = laravelInput(raw);
  const errors = await validate(
    input,
    { email: "required|email", password: "required" },
    {
      "email.required": "Please enter your email.",
      "email.email": "Please enter a valid email address.",
      "password.required": "Please enter your password.",
    },
  );
  if (errors) return backWithErrors(req, errors, withoutPasswords(input));
  // Auth::guard('customer')->attempt(): chi so email + mat khau, bo khach da xoa mem
  const customer = await db.customers.findFirst({ where: { email: String(input.email), deleted_at: null } });
  if (customer && (await checkPassword(String(input.password ?? ""), customer.password))) {
    await loginAs("customer", customer.id);
    return redirectWith(req, url("/"), { success: "Signed in successfully." });
  }
  return backWithErrors(req, { login: ["Your email or password is incorrect."] }, withoutPasswords(input));
}

/** POST /register.html — AuthController@registerAccount (AuthRegisterRequest) */
async function register({ req, input: raw }: { req: Request; input: Input }) {
  const input = laravelInput(raw);
  const errors = await validate(
    input,
    {
      name: "required|string|min:2|max:50",
      email: ["required", "email", "string", unique("customers", "email"), "max:191"],
      // Storefront: khach o My -> chap nhan so quoc te (ban goc chi nhan so VN 0[35789]xxxxxxxx)
      phone: ["required", regex(PHONE_RE)],
      address: "required|string|min:5|max:200",
      password: "required|string|min:6|max:50",
      re_password: "required|string|same:password",
    },
    {
      "name.required": "Enter your name.",
      "name.min": "Name must be at least 2 characters.",
      "name.max": "Name must be 50 characters or fewer.",
      "email.required": "Enter your email.",
      "email.email": "Enter a valid email address (e.g. name@example.com).",
      "email.unique": "An account with this email already exists.",
      "email.max": "Email must be 191 characters or fewer.",
      "phone.required": "Enter your phone number.",
      "phone.regex": "Enter a valid phone number.",
      "address.required": "Enter your address.",
      "address.min": "Address must be at least 5 characters.",
      "address.max": "Address must be 200 characters or fewer.",
      "password.required": "Enter a password.",
      "password.min": "Password must be at least 6 characters.",
      "password.max": "Password must be 50 characters or fewer.",
      "re_password.required": "Re-enter your password.",
      "re_password.same": "Passwords must match.",
    },
  );
  if (errors) return backWithErrors(req, errors, withoutPasswords(input));
  // CustomerService::create: publish = 2; code khong co trong form (MySQL non-strict cua Laravel ghi '').
  // Da sua: ban goc luon gan customer_catalogue_id = 1, ma bang customer_catalogues dang trong
  // -> loi khoa ngoai, khong ai dang ky duoc. Gio lay nhom mac dinh (xem defaultCustomerCatalogueId).
  const ts = now();
  try {
    const catalogueId = await defaultCustomerCatalogueId();
    await db.$executeRaw`
      INSERT INTO customers (name, email, phone, address, password, code, customer_catalogue_id, publish, created_at, updated_at)
      VALUES (${String(input.name)}, ${String(input.email)}, ${String(input.phone)}, ${String(input.address)},
        ${await hashPassword(String(input.password))}, '', ${catalogueId}, 2, ${ts}, ${ts})`;
  } catch (e) {
    const msg = e instanceof Error ? (e.message.match(/Message: `([\s\S]*)`\s*$/)?.[1] ?? e.message) : String(e);
    const code = e instanceof Error ? (e.message.match(/Code: `(\d+)`/)?.[1] ?? "") : "";
    return new Response(`SQLSTATE[23000]: Integrity constraint violation: ${code} ${msg}`, {
      headers: { "content-type": "text/html; charset=UTF-8" },
    });
  }
  return redirectWith(req, url("login.html"), { success: "Your account has been created. Please sign in." });
}

/**
 * Nhom khach cho tai khoan dang ky moi: id 1 nhu ban goc neu con; khong thi nhom dang hoat dong
 * dau tien; bang trong thi tao nhom "Khách hàng" (admin co the doi ten o QL Nhom Khach hang).
 */
async function defaultCustomerCatalogueId(): Promise<bigint> {
  const preferred = await db.customer_catalogues.findFirst({ where: { id: 1n, deleted_at: null } });
  if (preferred) return preferred.id;
  const any = await db.customer_catalogues.findFirst({ where: { deleted_at: null }, orderBy: [{ publish: "desc" }, { id: "asc" }] });
  if (any) return any.id;
  const ts = now();
  const created = await db.customer_catalogues.create({
    data: { name: "Customers", description: "Default group for self-registered customers", publish: 2, created_at: ts, updated_at: ts },
  });
  return created.id;
}

/** POST /logout.html — AuthController@logout */
async function logout({ req }: { req: Request }) {
  await logoutGuard("customer");
  return redirectWith(req, url("/"), { success: "You have signed out." });
}

/* --------------------------------- Tai khoan --------------------------------- */

/**
 * POST /account/update.html — CustomerController@updateProfile (EditProfileRequest).
 * O email tren form bi `disabled` nen khong duoc gui -> ban goc luon bao "Bạn chưa
 * nhập email." va khong cap nhat duoc. Giu nguyen.
 */
async function updateProfile({ req, input: raw }: { req: Request; input: Input }) {
  const customer = await customerOrRedirect(req);
  if (customer instanceof Response) return customer;
  // Da sua: o email tren form bi `disabled` nen trinh duyet khong gui len -> ban goc luon bao
  // "Ban chua nhap email." va khong ai cap nhat duoc ho so. Email khong cho sua tren giao dien,
  // nen dung email hien tai cua tai khoan.
  const input: Input = { ...laravelInput(raw), email: customer.email };
  const errors = await validate(
    input,
    {
      name: "required|string|min:2|max:50",
      email: ["required", "string", "email", "max:191", unique("customers", "email", { ignore: String(customer.id) })],
      phone: ["nullable", regex(PHONE_RE)],
      address: "required|string|min:5|max:200",
    },
    {
      "name.required": "Enter your name.",
      "name.min": "Name must be at least 2 characters.",
      "name.max": "Name must be 50 characters or fewer.",
      "email.required": "Enter your email.",
      "email.email": "Enter a valid email address.",
      "email.unique": "This email is already in use.",
      "email.max": "Email must be 191 characters or fewer.",
      "phone.regex": "Enter a valid phone number.",
      "address.required": "Enter your address.",
      "address.min": "Address must be at least 5 characters.",
      "address.max": "Address must be 200 characters or fewer.",
    },
  );
  if (errors) return backWithErrors(req, errors, withoutPasswords(input));
  await db.customers.update({
    where: { id: customer.id },
    data: {
      name: String(input.name),
      email: String(input.email),
      phone: input.phone === null || input.phone === undefined ? null : String(input.phone),
      address: String(input.address),
      updated_at: now(),
    },
  });
  return redirectWith(req, url("account.html"), { success: "Your profile has been updated." });
}

/** POST /account/password.html — CustomerController@updatePassword */
async function updatePassword({ req, input: raw }: { req: Request; input: Input }) {
  const customer = await customerOrRedirect(req);
  if (customer instanceof Response) return customer;
  const input = laravelInput(raw);
  const errors = await validate(
    input,
    { current_password: "required", password: "required|min:6|max:50|confirmed" },
    {
      "current_password.required": "Enter your current password.",
      "password.required": "Enter a new password.",
      "password.min": "Password must be at least 6 characters.",
      "password.max": "Password must be 50 characters or fewer.",
      "password.confirmed": "Passwords must match.",
    },
  );
  if (errors) return backWithErrors(req, errors, withoutPasswords(input));
  if (!(await checkPassword(String(input.current_password ?? ""), customer.password))) {
    await flash({ error: "Your current password is incorrect." });
    return back(req);
  }
  await db.customers.update({
    where: { id: customer.id },
    data: { password: await hashPassword(String(input.password)), updated_at: now() },
  });
  await flash({ success: "Your password has been changed." });
  return back(req);
}

/** Request::expectsJson() */
export function expectsJson(req: Request) {
  return req.headers.get("x-requested-with") === "XMLHttpRequest" || (req.headers.get("accept") ?? "").includes("/json");
}

function sniffImage(buf: Buffer): "jpg" | "png" | "webp" | "gif" | "bmp" | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buf.subarray(0, 4).toString("latin1") === "RIFF" && buf.subarray(8, 12).toString("latin1") === "WEBP") return "webp";
  if (buf.subarray(0, 4).toString("latin1") === "GIF8") return "gif";
  if (buf.subarray(0, 2).toString("latin1") === "BM") return "bmp";
  return null;
}

/**
 * CustomerController@uploadAvatar — dung chung cho POST /account/avatar.html
 * va POST /ajax/customer/uploadAvatar. File luu storage/uploads/customer/avatar
 * (public/uploads/... cua Laravel), phuc vu qua /uploads/....
 */
export async function uploadAvatar(req: Request, input: Input, customer: Customer): Promise<Response> {
  const file = input.avatar;
  let error: string | null = null;
  let buf: Buffer | null = null;
  if (!(file instanceof File) || file.size === 0) error = "The avatar field is required.";
  else {
    buf = Buffer.from(await file.arrayBuffer());
    const kind = sniffImage(buf);
    if (!kind) error = "The avatar field must be an image.";
    else if (!["jpg", "png", "webp"].includes(kind)) error = "The avatar field must be a file of type: jpg, jpeg, png, webp.";
    else if (file.size / 1024 > 2048) error = "The avatar field must not be greater than 2048 kilobytes.";
  }
  if (error) {
    if (expectsJson(req)) return laravelJson({ message: error, errors: { avatar: [error] } }, 422);
    return backWithErrors(req, { avatar: [error] }, {});
  }
  const f = file as File;
  const dir = "uploads/customer/avatar/";
  const ext = path.extname(f.name).replace(/^\./, "");
  const filename = `${Math.floor(Date.now() / 1000)}.${ext}`;
  await mkdir(path.join(STORAGE_DIR, dir), { recursive: true });
  await writeFile(path.join(STORAGE_DIR, dir, filename), buf!);
  // Xoa anh cu neu nam trong public (storage) cua minh. Ban goc dat ten theo time():
  // 2 lan upload trong cung 1 giay thi anh cu trung ten anh moi va bi xoa mat -> bo qua truong hop do.
  if (customer.image && /^\/?uploads\//.test(customer.image)) {
    const old = path.join(STORAGE_DIR, customer.image.replace(/^\/+/, ""));
    const fresh = path.join(STORAGE_DIR, dir, filename);
    if (old !== fresh && old.startsWith(path.join(STORAGE_DIR, "uploads"))) await unlink(old).catch(() => undefined);
  }
  const image = `${dir}${filename}`;
  await db.customers.update({ where: { id: customer.id }, data: { image, updated_at: now() } });
  return laravelJson({ status: "success", url: url(image) });
}

async function uploadAvatarForm({ req, input }: { req: Request; input: Input }) {
  const customer = await customerOrRedirect(req);
  if (customer instanceof Response) return customer;
  return uploadAvatar(req, input, customer);
}

/* --------------------------------- Gio hang --------------------------------- */

const CART_RULES = { fullname: "required", phone: "required", address: "required" };
const CART_MESSAGES = {
  "fullname.required": "Enter your full name.",
  "phone.required": "Enter your phone number.",
  "address.required": "Enter your address.",
};

/** POST /cart/create — CartController@store (StoreCartRequest) */
async function storeOrder({ req, input: raw }: { req: Request; input: Input }) {
  const input = laravelInput(raw);
  const errors = await validate(input, CART_RULES, CART_MESSAGES);
  if (errors) return backWithErrors(req, errors, withoutPasswords(input));
  const buyer = await currentCustomer();
  const s = await shopSession();
  try {
    await placeOrder(s, input, buyer);
  } catch (e) {
    // DB::rollBack(); echo $e->getMessage(); die();
    if (e instanceof PhpException) return phpDie(e);
    if (e instanceof Error) return new Response(e.message, { headers: { "content-type": "text/html; charset=UTF-8" } });
    throw e;
  }
  return redirectWith(req, url("cart/success.html"), { success: "Order placed, thank you!" });
}

/** POST /cart/createPay — CartController@storePay: ContactService::create */
async function storePay({ req, input: raw }: { req: Request; input: Input }) {
  const input = laravelInput(raw);
  const errors = await validate(input, CART_RULES, CART_MESSAGES);
  if (errors) return backWithErrors(req, errors, withoutPasswords(input));
  const idOrNull = (k: string) => (input[k] === undefined || input[k] === null || !/^\d+$/.test(String(input[k])) ? null : BigInt(String(input[k])));
  const productId = idOrNull("product_id");
  const postId = idOrNull("post_id");
  const ts = now();
  try {
    await db.$transaction(async (tx) => {
      // Contact::$fillable: name, phone, address, product_id, post_id, type (email NOT NULL -> '')
      await tx.$executeRaw`
        INSERT INTO contacts (name, phone, address, product_id, post_id, type, email, created_at, updated_at)
        VALUES (${String(input.name ?? input.fullname ?? "")}, ${String(input.phone)}, ${String(input.address)},
          ${productId}, ${postId}, ${input.type === undefined || input.type === null ? null : Math.trunc(Number(input.type)) || 0}, '', ${ts}, ${ts})`;
      if (productId !== null) {
        const p = await tx.$queryRaw<{ name: string }[]>`
          SELECT tb2.name FROM products JOIN product_language tb2 ON tb2.product_id = products.id
          WHERE products.id = ${productId} AND tb2.language_id = 1 LIMIT 1`;
        if (!p[0]) throw new PhpException('Attempt to read property "name" on null');
      }
    });
  } catch (e) {
    return phpDie(e);
  }
  return redirectWith(req, url("quick-checkout.html"), { success: "Request sent. We will contact you soon." });
}

export const routes: FormRoute[] = [
  { method: "POST", path: "login.html", handler: login },
  { method: "POST", path: "register.html", handler: register },
  { method: "POST", path: "logout.html", handler: logout },
  { method: "POST", path: "account/update.html", handler: updateProfile },
  { method: "POST", path: "account/password.html", handler: updatePassword },
  { method: "POST", path: "account/avatar.html", handler: uploadAvatarForm },
  { method: "POST", path: "cart/create", handler: storeOrder },
  { method: "POST", path: "cart/createPay", handler: storePay },
];
