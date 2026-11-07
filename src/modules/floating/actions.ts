"use server";

import { revalidatePath } from "next/cache";
import { can, getAdmin } from "@/server/auth";
import { normalizeFloating } from "./config";
import { saveFloatingConfig } from "./store";

/** Luu cau hinh nut lien he noi (quyen giong trinh dung giao dien). */
export async function saveFloatingAction(raw: unknown): Promise<{ ok: true }> {
  const admin = await getAdmin();
  if (!admin || !can(admin, "home.feature.index")) throw new Error("Bạn không có quyền sửa mục này.");
  await saveFloatingConfig(normalizeFloating(raw), BigInt(admin.id));
  revalidatePath("/", "layout");
  return { ok: true };
}
