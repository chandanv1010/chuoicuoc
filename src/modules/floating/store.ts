import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";
import { FRONTEND_LANGUAGE } from "@/modules/frontend/core";
import { FLOATING_KEY, normalizeFloating, type FloatingConfig } from "./config";

/** Cau hinh nut lien he noi (mot dong trong bang systems, ngon ngu storefront). */
export const getFloatingConfig = cache(async (): Promise<FloatingConfig> => {
  const row = await db.systems.findFirst({ where: { keyword: FLOATING_KEY, language_id: FRONTEND_LANGUAGE }, select: { content: true } });
  let raw: unknown = null;
  try {
    raw = row?.content ? JSON.parse(row.content) : null;
  } catch {
    raw = null;
  }
  return normalizeFloating(raw);
});

export async function saveFloatingConfig(config: FloatingConfig, userId: bigint) {
  const content = JSON.stringify(config);
  const now = new Date();
  const row = await db.systems.findFirst({ where: { keyword: FLOATING_KEY, language_id: FRONTEND_LANGUAGE }, select: { id: true } });
  if (row) await db.systems.update({ where: { id: row.id }, data: { content, updated_at: now } });
  else await db.systems.create({ data: { keyword: FLOATING_KEY, language_id: FRONTEND_LANGUAGE, user_id: userId, content, created_at: now, updated_at: now } });
}
