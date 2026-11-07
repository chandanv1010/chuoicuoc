import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export type SearchParams = Record<string, string | string[] | undefined>;

export function param(sp: SearchParams, key: string): string | undefined {
  const v = sp[key];
  return Array.isArray(v) ? v[0] : v;
}

/** $request->integer('x'): khong phai so thi 0. */
export function intParam(sp: SearchParams, key: string): number {
  const n = Number.parseInt(param(sp, key) ?? "", 10);
  return Number.isNaN(n) ? 0 : n;
}

/**
 * Tham so chung cua cac trang index: perpage, page, keyword, publish.
 * paginate($request->integer('perpage')): perpage = 0 thi Eloquent dung mac dinh 15.
 */
export function listParams(sp: SearchParams) {
  const perPage = intParam(sp, "perpage") || 15;
  const page = Math.max(1, intParam(sp, "page") || 1);
  return {
    perPage,
    page,
    offset: (page - 1) * perPage,
    keyword: (param(sp, "keyword") ?? "").trim(),
    publish: intParam(sp, "publish"),
  };
}

/**
 * $model->languages (pivot *_language): id ngon ngu ma tung ban ghi da co ban dich.
 * Dung cho cot "Da dich / Chua dich" (languageTd).
 */
export async function translatedLanguageIds(pivotTable: string, foreignKey: string, ids: (bigint | number)[]) {
  const map = new Map<string, Set<string>>();
  if (!ids.length) return map;
  if (!/^[a-z_]+$/.test(pivotTable) || !/^[a-z_]+$/.test(foreignKey)) throw new Error("Ten bang khong hop le");
  const rows = await db.$queryRawUnsafe<{ id: bigint; language_id: bigint }[]>(
    `SELECT \`${foreignKey}\` AS id, language_id FROM \`${pivotTable}\` WHERE \`${foreignKey}\` IN (${ids.map(() => "?").join(",")})`,
    ...ids.map(String),
  );
  for (const r of rows) {
    const key = r.id.toString();
    if (!map.has(key)) map.set(key, new Set());
    map.get(key)!.add(r.language_id.toString());
  }
  return map;
}

/** Ghep nhieu dieu kien Prisma.sql bang AND (bo qua null). */
export function where(parts: (Prisma.Sql | null | false | undefined)[]) {
  const list = parts.filter(Boolean) as Prisma.Sql[];
  return list.length ? Prisma.sql`WHERE ${Prisma.join(list, " AND ")}` : Prisma.empty;
}
