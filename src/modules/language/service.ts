import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { now } from "@/lib/helpers";
import type { Input } from "@/lib/http";
import { slugify } from "@/lib/slug";
import { listParams, where, type SearchParams } from "@/server/admin-list";
import { nullIfEmpty } from "@/modules/dashboard/ui";
import { modelMeta, TRANSLATE_FIELDS } from "./model-meta";

/** LanguageService + LanguageRepository (app/Services/V1/Core/LanguageService.php). */

export type LanguageRow = { id: bigint; name: string; canonical: string; publish: number; image: string | null };

export async function paginateLanguages(sp: SearchParams) {
  const { perPage, page, offset, keyword, publish } = listParams(sp);
  const cond = where([
    keyword ? Prisma.sql`name LIKE ${`%${keyword}%`}` : null,
    publish ? Prisma.sql`publish = ${publish}` : null,
    Prisma.sql`deleted_at IS NULL`,
  ]);
  const [rows, count] = await Promise.all([
    db.$queryRaw<LanguageRow[]>`
      SELECT id, name, canonical, publish, image FROM languages ${cond} ORDER BY id DESC LIMIT ${perPage} OFFSET ${offset}`,
    db.$queryRaw<{ c: bigint }[]>`SELECT COUNT(*) AS c FROM languages ${cond}`,
  ]);
  return { rows, total: Number(count[0].c), perPage, page };
}

export async function findLanguage(id: bigint) {
  return db.languages.findFirst({ where: { id, deleted_at: null } });
}

/** fill() theo $fillable: name, canonical, publish, user_id, image, current (description bi bo qua). */
function languageFields(input: Input) {
  const out: Record<string, unknown> = {};
  for (const k of ["name", "canonical", "image"]) if (k in input) out[k] = nullIfEmpty(input[k]);
  for (const k of ["publish", "current"]) if (k in input) out[k] = Number.parseInt(String(input[k] ?? 0), 10) || 0;
  return out;
}

export async function createLanguage(input: Input, userId: bigint) {
  const t = now();
  return db.languages.create({
    data: { ...(languageFields(input) as { name: string; canonical: string }), user_id: userId, created_at: t, updated_at: t },
  });
}

export async function updateLanguage(id: bigint, input: Input) {
  if (!(await findLanguage(id))) throw new Error(`No query results for model [App\\Models\\Language] ${id}`);
  await db.languages.update({ where: { id }, data: { ...languageFields(input), updated_at: now() } });
}

export async function destroyLanguage(id: bigint) {
  if (!(await findLanguage(id))) throw new Error(`No query results for model [App\\Models\\Language] ${id}`);
  const t = now();
  await db.languages.update({ where: { id }, data: { deleted_at: t, updated_at: t } });
}

/**
 * LanguageService::switch: current = 1 cho ngon ngu duoc chon, 0 cho moi ngon ngu khac
 * (updateByWhere tren model SoftDeletes -> chi cac dong chua xoa).
 */
export async function switchLanguage(id: bigint) {
  await db.$transaction(async (tx) => {
    const t = now();
    await tx.languages.update({ where: { id }, data: { current: 1, updated_at: t } });
    await tx.languages.updateMany({ where: { id: { not: id }, deleted_at: null }, data: { current: 0, updated_at: t } });
  });
}

// ------------------------------------------------------------------ translate

export type TranslateObject = {
  name: string | null;
  description: string | null;
  content: string | null;
  meta_title: string | null;
  meta_keyword: string | null;
  meta_description: string | null;
  canonical: string | null;
} | null;

/**
 * Tuong duong $repository->get{Model}ById($id, $languageId): join bang <model>s voi
 * <model>_language theo language_id (inner join -> chua dich thi null).
 */
export async function getObjectById(model: string, id: bigint, languageId: bigint): Promise<TranslateObject> {
  const meta = await modelMeta(model);
  if (!meta) return null;
  const cols = TRANSLATE_FIELDS.map((f) => (meta.pivotColumns.has(f) ? `tb2.\`${f}\`` : `NULL`) + ` AS \`${f}\``).join(", ");
  const soft = meta.tableColumns.has("deleted_at") ? "AND m.deleted_at IS NULL" : "";
  const rows = await db.$queryRawUnsafe<NonNullable<TranslateObject>[]>(
    `SELECT ${cols} FROM \`${meta.table}\` m JOIN \`${meta.pivot}\` tb2 ON tb2.\`${meta.foreignKey}\` = m.id
     WHERE m.id = ? AND tb2.language_id = ? ${soft} LIMIT 1`,
    String(id),
    String(languageId),
  );
  return rows[0] ?? null;
}

/** TranslateRequest: router trung canonical o ngon ngu khac (so sanh routers.id voi id model — giu nguyen bug). */
export async function translateCanonicalTaken(canonical: string, languageId: string, id: string) {
  const rows = await db.$queryRaw<{ c: bigint }[]>`
    SELECT COUNT(*) AS c FROM routers WHERE canonical = ${canonical} AND language_id <> ${languageId} AND id <> ${id}`;
  return Number(rows[0].c) > 0;
}

/**
 * LanguageService::saveTranslate: detach([$languageId, $model->id]) roi attach ban dich moi
 * vao <model>_language, xoa router cu cua ngon ngu do va tao router moi (Str::slug).
 * Chi ghi cac cot co trong pivot de dung duoc cho moi model.
 */
export async function saveTranslate(option: { id: string; languageId: string; model: string }, input: Input) {
  const meta = await modelMeta(option.model);
  if (!meta) throw new Error(`Class "\\App\\Repositories\\${option.model}Repository" not found`);
  const id = option.id;
  const languageId = option.languageId;
  const t = now();
  await db.$transaction(async (tx) => {
    const soft = meta.tableColumns.has("deleted_at") ? "AND deleted_at IS NULL" : "";
    const found = await tx.$queryRawUnsafe<{ id: bigint }[]>(`SELECT id FROM \`${meta.table}\` WHERE id = ? ${soft}`, id);
    if (!found.length) throw new Error(`No query results for model [App\\Models\\${option.model}] ${id}`);

    await tx.$executeRawUnsafe(
      `DELETE FROM \`${meta.pivot}\` WHERE \`${meta.foreignKey}\` = ? AND language_id IN (?, ?)`,
      id,
      languageId,
      id,
    );
    const data: Record<string, unknown> = { [meta.foreignKey]: id, language_id: languageId };
    for (const f of TRANSLATE_FIELDS) {
      if (meta.pivotColumns.has(f)) data[f] = input[`translate_${f}`] ?? null;
    }
    if (meta.pivotColumns.has("url")) data.url = "";
    if (meta.pivotColumns.has("created_at")) data.created_at = t;
    if (meta.pivotColumns.has("updated_at")) data.updated_at = t;
    const keys = Object.keys(data);
    await tx.$executeRawUnsafe(
      `INSERT INTO \`${meta.pivot}\` (${keys.map((k) => `\`${k}\``).join(", ")}) VALUES (${keys.map(() => "?").join(", ")})`,
      ...keys.map((k) => data[k]),
    );

    const controller = `App\\Http\\Controllers\\Frontend\\${option.model}Controller`;
    await tx.routers.deleteMany({ where: { module_id: BigInt(id), controllers: controller, language_id: BigInt(languageId) } });
    await tx.routers.create({
      data: {
        canonical: slugify(String(input.translate_canonical ?? "")),
        module_id: BigInt(id),
        language_id: BigInt(languageId),
        controllers: controller,
        created_at: t,
        updated_at: t,
      },
    });
  });
}
