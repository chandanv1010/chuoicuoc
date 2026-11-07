import { NextResponse, type NextRequest } from "next/server";

/**
 * 1. Cap cookie nc_sid (id phien an danh) cho flash message va gio hang.
 * 2. Form POST thuong (giong Laravel: POST post/store, POST {id}/update, DELETE
 *    qua _method) duoc chuyen vao /form-submit/<duong-dan>, noi bang dinh tuyen
 *    src/server/routes.ts goi dung handler. Nho vay trang GET va handler POST
 *    dung chung mot URL nhu ben Laravel (vd login.html).
 * 3. Gan header x-pathname / x-url de layout biet trang hien tai (request()->segment()).
 */
const PASSTHROUGH = ["/_next", "/ajax/", "/api/", "/ckfinder/", "/form-submit/"];

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const headers = new Headers(request.headers);
  headers.set("x-pathname", pathname);
  headers.set("x-url", `${pathname}${search}`);

  let sid = request.cookies.get("nc_sid")?.value;
  const newSid = !sid;
  if (!sid) {
    sid = crypto.randomUUID();
    // Them vao cookie cua chinh request nay de flash ghi duoc ngay lan dau
    const cookie = headers.get("cookie");
    headers.set("cookie", `${cookie ? `${cookie}; ` : ""}nc_sid=${sid}`);
  }

  const isForm =
    request.method !== "GET" &&
    request.method !== "HEAD" &&
    !request.headers.has("next-action") &&
    !PASSTHROUGH.some((p) => pathname.startsWith(p));

  const response = isForm
    ? NextResponse.rewrite(new URL(`/form-submit${pathname}${search}`, request.url), { request: { headers } })
    : NextResponse.next({ request: { headers } });

  if (newSid) response.cookies.set("nc_sid", sid, { httpOnly: true, sameSite: "lax", path: "/" });
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|vendor/|backend/|frontend/|userfiles/|uploads/).*)"],
};
