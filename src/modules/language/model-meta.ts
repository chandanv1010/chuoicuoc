import "server-only";
import { db } from "@/lib/db";

/**
 * Thong tin bang cua mot model Laravel theo quy uoc dat ten (dung chung cho trang
 * dich language/{id}/{languageId}/{model}/translate va ajax findModelObject):
 *   PostCatalogue -> post_catalogues, pivot post_catalogue_language, khoa post_catalogue_id.
 * Khong phu thuoc module cua nguoi khac: chi doc information_schema.
 */
export type ModelMeta = {
  model: string;
  snake: string;
  table: string;
  pivot: string;
  foreignKey: string;
  tableColumns: Set<string>;
  pivotColumns: Set<string>;
};

/** LanguageService::converModelToField / Str::snake */
export function snakeModel(model: string) {
  return model.replace(/(?<!^)[A-Z]/g, (c) => `_${c}`).toLowerCase();
}

const cache = new Map<string, Promise<Map<string, Set<string>>>>();

async function columnsOf(tables: string[]) {
  const key = tables.join(",");
  let p = cache.get(key);
  if (!p) {
    p = db
      .$queryRawUnsafe<{ t: string; c: string }[]>(
        `SELECT TABLE_NAME AS t, COLUMN_NAME AS c FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (${tables.map(() => "?").join(",")})`,
        ...tables,
      )
      .then((rows) => {
        const map = new Map<string, Set<string>>();
        for (const r of rows) {
          if (!map.has(r.t)) map.set(r.t, new Set());
          map.get(r.t)!.add(r.c);
        }
        return map;
      });
    cache.set(key, p);
    p.catch(() => cache.delete(key));
  }
  return p;
}

/** null neu ten model khong hop le hoac khong co bang <snake>s + <snake>_language. */
export async function modelMeta(model: string): Promise<ModelMeta | null> {
  if (!/^[A-Z][A-Za-z]*$/.test(model)) return null;
  const snake = snakeModel(model);
  const table = `${snake}s`;
  const pivot = `${snake}_language`;
  const foreignKey = `${snake}_id`;
  const cols = await columnsOf([table, pivot]);
  const tableColumns = cols.get(table);
  const pivotColumns = cols.get(pivot);
  if (!tableColumns || !pivotColumns || !pivotColumns.has(foreignKey) || !pivotColumns.has("language_id")) return null;
  return { model, snake, table, pivot, foreignKey, tableColumns, pivotColumns };
}

/** Cac cot ban dich ma form translate dung (chi lay cot co trong pivot). */
export const TRANSLATE_FIELDS = ["name", "description", "content", "meta_title", "meta_keyword", "meta_description", "canonical"] as const;
