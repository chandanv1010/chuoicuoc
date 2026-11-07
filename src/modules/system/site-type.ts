import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";
import { FRONTEND_LANGUAGE } from "@/modules/frontend/core";

/**
 * Tai khoan goc (nguoi lam web): luon du moi quyen, chi chinh no moi sua / khoa / xoa duoc no, va la nguoi duy nhat
 * doi duoc loai website. Nhan dien bang email co dinh trong code de khong ai doi duoc tu trang quan tri.
 */
export const ROOT_EMAIL = "chandanv1010@gmail.com";

export const isRootEmail = (email: string | null | undefined) => (email ?? "").trim().toLowerCase() === ROOT_EMAIL;

/** id tai khoan goc (null neu chua co). */
export const rootUserId = cache(async () => {
  const row = await db.users.findFirst({ where: { email: ROOT_EMAIL, deleted_at: null }, select: { id: true } });
  return row?.id ?? null;
});

/** Tai khoan dang thao tac co bi chan khi dong vao user `targetId` khong (user goc, nguoi thao tac khong phai goc). */
export async function rootLocked(actorEmail: string, targetId: bigint | string | number) {
  if (isRootEmail(actorEmail)) return false;
  const root = await rootUserId();
  return root !== null && String(root) === String(targetId);
}

/** Loai website: "shop" (ban hang, mac dinh) hoac "news" (tin tuc — an moi muc lien quan san pham trong admin). */
export type SiteType = "shop" | "news";
const SITE_TYPE_KEY = "site_type";

export const getSiteType = cache(async (): Promise<SiteType> => {
  const row = await db.systems.findFirst({ where: { keyword: SITE_TYPE_KEY, language_id: FRONTEND_LANGUAGE }, select: { content: true } });
  return row?.content === "news" ? "news" : "shop";
});

export async function saveSiteType(type: SiteType, userId: bigint) {
  const now = new Date();
  const row = await db.systems.findFirst({ where: { keyword: SITE_TYPE_KEY, language_id: FRONTEND_LANGUAGE }, select: { id: true } });
  if (row) await db.systems.update({ where: { id: row.id }, data: { content: type, updated_at: now } });
  else await db.systems.create({ data: { keyword: SITE_TYPE_KEY, language_id: FRONTEND_LANGUAGE, user_id: userId, content: type, created_at: now, updated_at: now } });
}
