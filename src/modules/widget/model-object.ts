import "server-only";
import { db } from "@/lib/db";
import { modelMeta } from "@/modules/language/model-meta";

/**
 * BaseRepository::findWidgetItem (dung cho ajax findModelObject va trang sua widget):
 *   $model->with(['languages' => language_id = $lang])->whereHas('languages', alias.name LIKE ...)->get()
 * Tra ve JSON giong Eloquent toArray(): cot cua model + languages[] (Language + pivot).
 */

const TIMESTAMP_COLS = new Set(["created_at", "updated_at", "deleted_at", "email_verified_at"]);

/** Gia tri cot -> JSON nhu Eloquent (timestamps: ISO UTC; datetime khac: 'Y-m-d H:i:s'). */
function jsonValue(key: string, v: unknown): unknown {
  if (typeof v === "bigint") return Number(v);
  if (v instanceof Date) {
    if (TIMESTAMP_COLS.has(key)) {
      // DB luu gio Asia/Ho_Chi_Minh; Carbon::toJSON() doi ra UTC
      return new Date(v.getTime() - 7 * 3600_000).toISOString().replace(/\.(\d{3})Z$/, ".$1000Z");
    }
    return v.toISOString().slice(0, 19).replace("T", " ");
  }
  if (v && typeof v === "object" && "toFixed" in v) return String(v); // Prisma.Decimal
  return v;
}

export function toLaravelJson(row: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(row).map(([k, v]) => [k, jsonValue(k, v)]));
}

export async function findWidgetItem(model: string, keyword: string, languageId: bigint) {
  const meta = await modelMeta(model);
  if (!meta) return null;
  const soft = meta.tableColumns.has("deleted_at") ? `AND m.deleted_at IS NULL` : "";
  const rows = await db.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT m.* FROM \`${meta.table}\` m
     WHERE EXISTS (SELECT 1 FROM \`${meta.pivot}\` p WHERE p.\`${meta.foreignKey}\` = m.id AND p.name LIKE ?) ${soft}`,
    `%${keyword}%`,
  );
  if (!rows.length) return [];
  const ids = rows.map((r) => String(r.id));
  const pivots = await db.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT p.* FROM \`${meta.pivot}\` p WHERE p.language_id = ? AND p.\`${meta.foreignKey}\` IN (${ids.map(() => "?").join(",")})`,
    String(languageId),
    ...ids,
  );
  const languages = await db.$queryRawUnsafe<Record<string, unknown>[]>(`SELECT * FROM languages WHERE id = ?`, String(languageId));
  const language = languages[0] ? toLaravelJson(languages[0]) : null;
  return rows.map((r) => {
    const own = pivots.filter((p) => String(p[meta.foreignKey]) === String(r.id));
    return {
      ...toLaravelJson(r),
      languages: language ? own.map((p) => ({ ...language, pivot: toLaravelJson(p) })) : [],
    };
  });
}

/**
 * WidgetController@edit: convertArrayByKey($repo->findByCondition([], true, languages(lang),
 * ['id','desc'], whereIn id), ['id','name.languages','image']).
 * Ban ghi khong co ban dich cua ngon ngu hien tai -> Laravel loi (first() null); o day bo qua.
 */
export async function widgetItems(model: string, ids: string[], languageId: bigint) {
  const meta = await modelMeta(model);
  const out = { id: [] as string[], name: [] as string[], image: [] as string[] };
  if (!meta || !ids.length) return out;
  const clean = ids.filter((x) => /^\d+$/.test(String(x)));
  if (!clean.length) return out;
  const soft = meta.tableColumns.has("deleted_at") ? `AND m.deleted_at IS NULL` : "";
  const image = meta.tableColumns.has("image") ? "m.image" : "NULL";
  const rows = await db.$queryRawUnsafe<{ id: bigint; image: string | null; name: string | null }[]>(
    `SELECT m.id, ${image} AS image, p.name FROM \`${meta.table}\` m
     LEFT JOIN \`${meta.pivot}\` p ON p.\`${meta.foreignKey}\` = m.id AND p.language_id = ?
     WHERE m.id IN (${clean.map(() => "?").join(",")}) ${soft}
     ORDER BY m.id DESC`,
    String(languageId),
    ...clean,
  );
  for (const r of rows) {
    if (r.name === null) continue;
    out.id.push(r.id.toString());
    out.name.push(r.name);
    out.image.push(r.image ?? "");
  }
  return out;
}
