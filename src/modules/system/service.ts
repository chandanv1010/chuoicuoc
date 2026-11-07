import "server-only";
import { db } from "@/lib/db";
import type { Input } from "@/lib/http";

/**
 * SystemService::save / IntroduceService::save (app/Services/V1/Core/*):
 * moi config[key] => updateOrInsert(['keyword','language_id'], ['keyword','content','language_id','user_id']).
 * Query Builder updateOrInsert khong tu ghi created_at/updated_at — giu nguyen.
 */
export async function readKeywordTable(table: "systems" | "introduces", languageId: bigint) {
  const rows =
    table === "systems"
      ? await db.systems.findMany({ where: { language_id: languageId }, orderBy: { id: "desc" } })
      : await db.introduces.findMany({ where: { language_id: languageId }, orderBy: { id: "desc" } });
  // convert_array: key trung thi dong sau (id nho hon) ghi de — giong foreach cua PHP
  const out: Record<string, string> = {};
  for (const r of rows) out[r.keyword] = r.content ?? "";
  return out;
}

export async function saveKeywordTable(table: "systems" | "introduces", input: Input, languageId: bigint, userId: bigint) {
  const config = input.config;
  if (!config || typeof config !== "object") {
    // count(null) -> TypeError trong PHP 8 -> catch -> echo/die
    throw new Error("count(): Argument #1 ($value) must be of type Countable|array, null given");
  }
  await db.$transaction(async (tx) => {
    for (const [keyword, raw] of Object.entries(config as Record<string, unknown>)) {
      // TrimStrings + ConvertEmptyStringsToNull
      const val = typeof raw === "string" ? (raw.trim() === "" ? null : raw.trim()) : null;
      const updated =
        table === "systems"
          ? await tx.$executeRaw`UPDATE systems SET keyword = ${keyword}, content = ${val}, language_id = ${languageId}, user_id = ${userId} WHERE keyword = ${keyword} AND language_id = ${languageId} LIMIT 1`
          : await tx.$executeRaw`UPDATE introduces SET keyword = ${keyword}, content = ${val}, language_id = ${languageId}, user_id = ${userId} WHERE keyword = ${keyword} AND language_id = ${languageId} LIMIT 1`;
      if (updated > 0) continue;
      const exists =
        table === "systems"
          ? await tx.$queryRaw<{ c: bigint }[]>`SELECT COUNT(*) AS c FROM systems WHERE keyword = ${keyword} AND language_id = ${languageId}`
          : await tx.$queryRaw<{ c: bigint }[]>`SELECT COUNT(*) AS c FROM introduces WHERE keyword = ${keyword} AND language_id = ${languageId}`;
      if (Number(exists[0].c) > 0) continue; // co dong nhung gia tri khong doi
      if (table === "systems") {
        await tx.$executeRaw`INSERT INTO systems (keyword, content, language_id, user_id) VALUES (${keyword}, ${val}, ${languageId}, ${userId})`;
      } else {
        await tx.$executeRaw`INSERT INTO introduces (keyword, content, language_id, user_id) VALUES (${keyword}, ${val}, ${languageId}, ${userId})`;
      }
    }
  }, { timeout: 30_000 });
}
