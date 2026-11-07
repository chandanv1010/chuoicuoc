import "server-only";
import { forbidden, redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/lib/db";
import { flash } from "@/lib/flash";
import { currentId } from "@/lib/session";
import { absoluteUrl } from "@/lib/origin";
import { isRootEmail } from "@/modules/system/site-type";

/** User admin dang dang nhap (Auth::user()), kem danh sach quyen cua nhom. */
export const getAdmin = cache(async () => {
  const id = await currentId("admin");
  if (!id) return null;
  const user = await db.users.findFirst({ where: { id, deleted_at: null } });
  if (!user) return null;
  const perms = await db.$queryRaw<{ canonical: string }[]>`
    SELECT p.canonical FROM user_catalogue_permission ucp
    JOIN permissions p ON p.id = ucp.permission_id
    WHERE ucp.user_catalogue_id = ${user.user_catalogue_id}`;
  return { ...user, permissions: new Set(perms.map((p) => p.canonical)) };
});

export type Admin = NonNullable<Awaited<ReturnType<typeof getAdmin>>>;

/** Middleware 'admin' (AuthenticateMiddleware) cho trang GET. */
export async function requireAdmin(): Promise<Admin> {
  const admin = await getAdmin();
  if (!admin) {
    await flash({ error: "Bạn phải đăng nhập để sử dụng chức năng này" });
    redirect("/admin");
  }
  return admin;
}

/** Gate 'modules' trong AuthServiceProvider: $this->authorize('modules', 'post.index'). */
export function can(admin: Admin, permission: string) {
  // Tai khoan goc (modules/system/site-type.ts) luon du quyen, khong phu thuoc nhom thanh vien
  if (isRootEmail(admin.email)) return true;
  if (admin.publish === 0) return false;
  return admin.permissions.has(permission);
}

export async function authorize(permission: string): Promise<Admin> {
  const admin = await requireAdmin();
  if (!can(admin, permission)) forbidden();
  return admin;
}

/** Dung trong route handler (POST): tra ve Response neu chua dang nhap / khong co quyen. */
export async function authorizeHandler(req: Request, permission?: string): Promise<Admin | Response> {
  const admin = await getAdmin();
  if (!admin) {
    await flash({ error: "Bạn phải đăng nhập để sử dụng chức năng này" });
    return Response.redirect(absoluteUrl(req, "/admin"), 303);
  }
  if (permission && !can(admin, permission)) {
    return new Response("403 | This action is unauthorized.", { status: 403 });
  }
  return admin;
}
