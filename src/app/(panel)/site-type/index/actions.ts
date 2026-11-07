"use server";

import { revalidatePath } from "next/cache";
import { getAdmin } from "@/server/auth";
import { isRootEmail, saveSiteType, type SiteType } from "@/modules/system/site-type";

export async function saveSiteTypeAction(type: SiteType) {
  const admin = await getAdmin();
  if (!admin || !isRootEmail(admin.email)) throw new Error("Chỉ tài khoản gốc mới đổi được loại website.");
  await saveSiteType(type === "news" ? "news" : "shop", BigInt(admin.id));
  revalidatePath("/", "layout");
  return { ok: true as const };
}
