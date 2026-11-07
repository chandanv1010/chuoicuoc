import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { now } from "@/lib/helpers";
import type { Input } from "@/lib/http";
import { listParams, where, type SearchParams } from "@/server/admin-list";
import { phpJson } from "@/modules/dashboard/statistic";

/**
 * WidgetService (phan admin) + WidgetRepository (app/Services/V1/Core/WidgetService.php).
 * Cot description/album/model_id la JSON (cast 'json' trong model Widget).
 */

export type WidgetRow = {
  id: bigint;
  name: string;
  keyword: string;
  short_code: string | null;
  publish: number;
  description: string | null;
  note: string | null;
};

export async function paginateWidgets(sp: SearchParams) {
  const { perPage, page, offset, keyword, publish } = listParams(sp);
  const cond = where([
    keyword ? Prisma.sql`name LIKE ${`%${keyword}%`}` : null,
    publish ? Prisma.sql`publish = ${publish}` : null,
    Prisma.sql`deleted_at IS NULL`,
  ]);
  const [rows, count] = await Promise.all([
    db.$queryRaw<WidgetRow[]>`
      SELECT id, name, keyword, short_code, publish, description, note FROM widgets ${cond}
      ORDER BY id DESC LIMIT ${perPage} OFFSET ${offset}`,
    db.$queryRaw<{ c: bigint }[]>`SELECT COUNT(*) AS c FROM widgets ${cond}`,
  ]);
  return { rows, total: Number(count[0].c), perPage, page };
}

/** json_decode an toan (cast 'json'): loi thi null. */
export function jsonOf(v: string | null | undefined): unknown {
  if (v === null || v === undefined) return null;
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
}

/** $widget->description la mang theo language_id; chuoi cu thi tra nguyen chuoi. */
export function descriptionMap(v: string | null | undefined): Record<string, unknown> | string {
  const d = jsonOf(v);
  if (Array.isArray(d)) return Object.fromEntries(d.map((x, i) => [String(i), x]));
  if (d && typeof d === "object") return d as Record<string, unknown>;
  if (typeof d === "string") return d;
  return typeof v === "string" && d === null ? v : "";
}

export async function findWidget(id: bigint) {
  return db.widgets.findFirst({ where: { id, deleted_at: null } });
}

function arrOrNull(v: unknown): unknown[] | null {
  if (Array.isArray(v)) return v;
  if (v && typeof v === "object") return Object.values(v);
  return null;
}

/**
 * $request->only('name','keyword','short_code','description','album','model','note')
 * + model_id = modelItem.id + description = [$languageId => description].
 */
function widgetPayload(input: Input, languageId: bigint, create: boolean) {
  const out: Record<string, unknown> = {};
  // only(): key khong co trong request thi khong dua vao payload (update giu gia tri cu)
  for (const k of ["name", "keyword", "short_code", "note"]) if (k in input) out[k] = input[k] ?? null;
  // Cac cot album/model/model_id NOT NULL: ban goc khong gui (chua chon anh/module) se loi SQL
  // (echo/die); o day ghi chuoi rong de khong sap — giong du lieu widget hien co.
  if ("model" in input || create) out.model = input.model ?? "";
  const album = arrOrNull(input.album);
  if (album) out.album = phpJson(album);
  else if (create) out.album = "";
  const modelItem = input.modelItem && typeof input.modelItem === "object" ? (input.modelItem as Record<string, unknown>) : null;
  const ids = arrOrNull(modelItem?.id);
  out.model_id = ids ? phpJson(ids) : "";
  out.description = phpJson({ [languageId.toString()]: input.description ?? null });
  return out;
}

export async function createWidget(input: Input, languageId: bigint) {
  const t = now();
  return db.widgets.create({
    data: { ...(widgetPayload(input, languageId, true) as Prisma.widgetsCreateInput), created_at: t, updated_at: t },
  });
}

export async function updateWidget(id: bigint, input: Input, languageId: bigint) {
  if (!(await findWidget(id))) throw new Error(`No query results for model [App\\Models\\Widget] ${id}`);
  await db.widgets.update({ where: { id }, data: { ...(widgetPayload(input, languageId, false) as Prisma.widgetsUpdateInput), updated_at: now() } });
}

export async function destroyWidget(id: bigint) {
  if (!(await findWidget(id))) throw new Error(`No query results for model [App\\Models\\Widget] ${id}`);
  const t = now();
  await db.widgets.update({ where: { id }, data: { deleted_at: t, updated_at: t } });
}

/** WidgetService::saveTranslate: description[translateId] = translate_description. */
export async function saveWidgetTranslate(input: Input) {
  const widgetId = String(input.widgetId ?? "");
  if (!/^\d+$/.test(widgetId)) throw new Error("No query results for model [App\\Models\\Widget]");
  const widget = await findWidget(BigInt(widgetId));
  if (!widget) throw new Error(`No query results for model [App\\Models\\Widget] ${widgetId}`);
  const current = jsonOf(widget.description);
  // $temp = $widget->description; $temp[$translateId] = ... (chuoi/null -> mang moi)
  const temp: Record<string, unknown> =
    current && typeof current === "object"
      ? Array.isArray(current)
        ? Object.fromEntries(current.map((x, i) => [String(i), x]))
        : { ...(current as Record<string, unknown>) }
      : {};
  temp[String(input.translateId ?? "")] = input.translate_description ?? null;
  await db.widgets.update({ where: { id: widget.id }, data: { description: phpJson(temp), updated_at: now() } });
}
