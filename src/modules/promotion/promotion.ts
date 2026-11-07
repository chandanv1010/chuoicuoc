import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { now } from "@/lib/helpers";
import { formatMoney, parseMoney, parseMoneyOrZero } from "@/lib/money";
import type { Input } from "@/lib/http";
import { listParams, where, type SearchParams } from "@/server/admin-list";
import { dataGet, laravelInput, only, parseDmyHi, phpJson, sqlDate } from "./php";

/**
 * PromotionRepository + PromotionService (app/Services/V1/Product/PromotionService.php)
 * va PromotionEnum (app/Enums/PromotionEnum.php).
 */
export const PromotionEnum = {
  ORDER_AMOUNT_RANGE: "order_amount_range",
  PRODUCT_AND_QUANTITY: "product_and_quantity",
  BUY_PRODUCT_TAKE_GIFT: "buy_product_take_gift",
  BUY_COMBO: "buy_combo",
  MODULE_TYPE: "module_type",
  DISCOUNT: "discountInformation",
} as const;

export type PromotionRow = {
  id: bigint;
  name: string;
  code: string;
  description: string | null;
  method: string;
  discountInformation: string | null;
  neverEndDate: string | null;
  startDate: Date;
  endDate: Date | null;
  publish: number;
  order: number;
};

export type Promotion = Omit<PromotionRow, "discountInformation"> & {
  discountInformation: Record<string, unknown> | null;
};

/** $casts['discountInformation' => 'json'] */
function decode(json: string | null): Record<string, unknown> | null {
  if (!json) return null;
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/** PromotionService::paginate — keyword theo name, publish, id DESC, bo ban ghi da xoa mem. */
export async function paginatePromotions(sp: SearchParams) {
  const { perPage, page, offset, keyword, publish } = listParams(sp);
  const cond = where([
    keyword ? Prisma.sql`name LIKE ${`%${keyword}%`}` : null,
    publish ? Prisma.sql`publish = ${publish}` : null,
    Prisma.sql`deleted_at IS NULL`,
  ]);
  const [rows, count] = await Promise.all([
    db.$queryRaw<PromotionRow[]>`
      SELECT id, name, code, description, method, discountInformation, neverEndDate, startDate, endDate, publish, \`order\`
      FROM promotions ${cond} ORDER BY id DESC LIMIT ${perPage} OFFSET ${offset}`,
    db.$queryRaw<{ c: bigint }[]>`SELECT COUNT(*) AS c FROM promotions ${cond}`,
  ]);
  return {
    rows: rows.map((r) => ({ ...r, discountInformation: decode(r.discountInformation) })) as Promotion[],
    total: Number(count[0].c),
    perPage,
    page,
  };
}

/** findById (findOrFail, bo qua ban ghi da xoa mem). */
export async function findPromotion(id: bigint): Promise<Promotion | null> {
  const rows = await db.$queryRaw<PromotionRow[]>`
    SELECT id, name, code, description, method, discountInformation, neverEndDate, startDate, endDate, publish, \`order\`
    FROM promotions WHERE id = ${id} AND deleted_at IS NULL LIMIT 1`;
  if (!rows.length) return null;
  return { ...rows[0], discountInformation: decode(rows[0].discountInformation) };
}

/** Helper convertData($promotion, 'products'|'product_gifts') trong MyHelper.php. */
export async function convertData(promotionId: bigint, type: "products" | "product_gifts") {
  const table = type === "products" ? Prisma.raw("promotion_rules") : Prisma.raw("promotion_gifts");
  // $payload_pivot[$k]->languages->first()->pivot->name: ban dich dau tien cua san pham
  const rows = await db.$queryRaw<{ product_id: bigint; quantity: number; image: string | null; name: string | null }[]>`
    SELECT t.product_id, t.quantity, p.image,
      (SELECT pl.name FROM product_language pl WHERE pl.product_id = p.id LIMIT 1) AS name
    FROM ${table} t JOIN products p ON p.id = t.product_id
    WHERE t.promotion_id = ${promotionId} ORDER BY t.id`;
  if (!rows.length) return [];
  const temp: Record<string, unknown[]> = { id: [], quantity: [], image: [], name: [] };
  for (const r of rows) {
    temp.id.push(Number(r.product_id));
    temp.quantity.push(r.quantity);
    temp.image.push(r.image);
    temp.name.push(r.name);
  }
  return temp;
}

/** renderDiscountInformation($promotion) trong MyHelper.php: tra ve HTML. */
export function renderDiscountInformation(p: Promotion): string {
  if (p.method === PromotionEnum.PRODUCT_AND_QUANTITY) {
    const info = (p.discountInformation?.info ?? {}) as Record<string, unknown>;
    // percent: "10%"; tien mat: "$5.00"
    const text = info.discountType === "percent" ? `${String(info.discountValue ?? "")}%` : formatMoney(info.discountValue);
    return `<span class="label label-success">${escapeHtml(text)} </span>`;
  }
  return `<div><a href="/promotion/${p.id}/edit">Xem chi tiết</a></div>`;
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/* ------------------------------ Service ------------------------------ */

type Arr = Record<string, unknown>;
const listOf = (v: unknown): unknown[] => (Array.isArray(v) ? v : v && typeof v === "object" ? Object.values(v) : []);

/** handleSourceAndCondition() */
function handleSourceAndCondition(req: Input) {
  const data: Arr = {
    source: { status: req.source ?? null, data: req.sourceValue ?? null },
    apply: { status: req.applyStatus ?? null, data: req.applyValue ?? null } as Arr,
  };
  const apply = data.apply as Arr;
  if (apply.data !== null && apply.data !== undefined) {
    const condition: Arr = {};
    for (const val of listOf(apply.data)) condition[String(val)] = req[String(val)] ?? null;
    apply.condition = condition;
  }
  return data;
}

/** Chuan hoa tien trong JSON: "$1,234.50" -> "1234.50" (rong / khong hop le giu nguyen de rule bao loi). */
const money = (v: unknown) => (v === null || v === undefined ? v : (parseMoney(v) ?? v));
function moneyFields(o: Arr | null | undefined, keys: string[]): Arr | null | undefined {
  if (!o || typeof o !== "object") return o;
  const out: Arr = { ...o };
  for (const k of keys) {
    if (!(k in out)) continue;
    const v = out[k];
    out[k] = Array.isArray(v) ? v.map(money) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v as Arr).map(([i, x]) => [i, money(x)])) : money(v);
  }
  return out;
}

/** discountInformation theo tung hinh thuc (orderByRange/productAndQuantity/...). */
function discountInformation(req: Input, method: string): Arr | undefined {
  const model = req[PromotionEnum.MODULE_TYPE] ?? null;
  switch (method) {
    case PromotionEnum.ORDER_AMOUNT_RANGE:
      // amountValue: tien hoac % tuy amountType — deu la so 2 chu so
      return {
        info: moneyFields(req.promotion_order_amount_range as Arr | null | undefined, ["amountFrom", "amountTo", "amountValue"]) ?? null,
        ...handleSourceAndCondition(req),
      };
    case PromotionEnum.PRODUCT_AND_QUANTITY: {
      const info = { ...(moneyFields(req.product_and_quantity as Arr | null | undefined, ["maxDiscountValue", "discountValue"]) ?? {}) };
      info.model = model;
      info.object = req.object ?? null;
      return { info, ...handleSourceAndCondition(req) };
    }
    case PromotionEnum.BUY_PRODUCT_TAKE_GIFT:
      return { info: { model }, ...handleSourceAndCondition(req) };
    case PromotionEnum.BUY_COMBO: {
      const info = { ...(moneyFields(req.product_combos as Arr | null | undefined, ["price"]) ?? {}) };
      info.model = model;
      return { info, ...handleSourceAndCondition(req) };
    }
  }
  return undefined;
}

/** PromotionService::request(): payload ghi vao bang promotions. */
function payloadOf(req: Input) {
  // $request->only(...): key khong co trong form thi khong ghi (vd neverEndDate bo tick khi update)
  const payload: Arr = only(req, ["name", "code", "description", "method", "startDate", "endDate", "neverEndDate"]);
  // DECIMAL(12,2): USD co xu ("5", "4.99", "$1,234.50" -> "1234.50"); discountType = percent thi la %
  payload.maxDiscountValue = parseMoneyOrZero(dataGet(req, "product_and_quantity.maxDiscountValue"));
  payload.discountValue = parseMoneyOrZero(dataGet(req, "product_and_quantity.discountValue"));
  payload.discountType = dataGet(req, "product_and_quantity.discountType") ?? "";
  const start = parseDmyHi(payload.startDate);
  if (!start) throw new Error("Carbon: ngay bat dau khong dung dinh dang");
  payload.startDate = sqlDate(start);
  if (payload.endDate !== undefined && payload.endDate !== null) {
    const end = parseDmyHi(payload.endDate);
    if (!end) throw new Error("Carbon: ngay ket thuc khong dung dinh dang");
    payload.endDate = sqlDate(end);
  }
  // empty($payload['code']) ? time() : ...
  payload.code = payload.code && payload.code !== "0" ? payload.code : Math.floor(Date.now() / 1000);
  const info = discountInformation(req, String(payload.method ?? ""));
  if (info !== undefined) payload.discountInformation = phpJson(info);
  return payload;
}

const COLUMNS = new Set([
  "name", "code", "description", "method", "discountInformation", "discountValue", "discountType",
  "maxDiscountValue", "neverEndDate", "startDate", "endDate",
]);

function sqlValue(v: unknown) {
  if (v === null || v === undefined) return null;
  if (typeof v === "object") return phpJson(v); // mang khong co cast -> Laravel se loi "Array to string"
  return v as string | number;
}

/** handleRelation() */
async function handleRelation(tx: Prisma.TransactionClient, req: Input, promotionId: bigint, method: "create" | "update") {
  const t = sqlDate(now());
  const type = req.method;
  if (type === PromotionEnum.PRODUCT_AND_QUANTITY) {
    const object = req.object as Arr | null | undefined;
    const rows: [unknown, unknown, unknown][] = [];
    if (object !== null && object !== undefined) {
      const variant = listOf(object.variant_uuid);
      listOf(object.id).forEach((val, key) => rows.push([val, variant[key] ?? null, req[PromotionEnum.MODULE_TYPE] ?? null]));
    }
    // update: detach() roi sync(); create: sync() — deu xoa het roi them lai
    await tx.$executeRaw`DELETE FROM promotion_product_variant WHERE promotion_id = ${promotionId}`;
    for (const [productId, uuid, model] of rows) {
      await tx.$executeRaw`INSERT INTO promotion_product_variant (promotion_id, product_id, variant_uuid, model, created_at, updated_at)
        VALUES (${promotionId}, ${sqlValue(productId)}, ${sqlValue(uuid)}, ${sqlValue(model)}, ${t}, ${t})`;
    }
  } else if (type === PromotionEnum.BUY_PRODUCT_TAKE_GIFT) {
    const sync = async (table: "promotion_rules" | "promotion_gifts", data: Arr | null | undefined) => {
      if (data === null || data === undefined) return;
      const qty = listOf(data.quantity);
      const tbl = Prisma.raw(table);
      await tx.$executeRaw`DELETE FROM ${tbl} WHERE promotion_id = ${promotionId}`;
      const ids = listOf(data.id);
      for (let k = 0; k < ids.length; k++) {
        await tx.$executeRaw`INSERT INTO ${tbl} (promotion_id, product_id, quantity) VALUES (${promotionId}, ${sqlValue(ids[k])}, ${sqlValue(qty[k] ?? null)})`;
      }
    };
    await sync("promotion_rules", req.products as Arr | null | undefined);
    await sync("promotion_gifts", req.product_gifts as Arr | null | undefined);
  } else if (type === PromotionEnum.BUY_COMBO) {
    const object = req.product_combos as Arr | null | undefined;
    if (!object) throw new Error("Trying to access array offset on value of type null");
    // Combo::insert() moi lan luu (ca khi update — giu nguyen hanh vi goc, combo cu van dung)
    await tx.$executeRaw`INSERT INTO promotion_combos (promotion_id, price) VALUES (${promotionId}, ${parseMoneyOrZero(object.price)})`;
    const combo = await tx.$queryRaw<{ id: bigint }[]>`SELECT id FROM promotion_combos WHERE promotion_id = ${promotionId} AND deleted_at IS NULL ORDER BY id LIMIT 1`;
    const comboId = combo[0].id;
    const ids = listOf(object.id);
    if (ids.length && object.uuid === undefined) throw new Error("Trying to access array offset on value of type null");
    const uuids = listOf(object.uuid);
    const qty = listOf(object.quantity);
    await tx.$executeRaw`DELETE FROM combo_products WHERE combo_id = ${comboId}`;
    for (let k = 0; k < ids.length; k++) {
      await tx.$executeRaw`INSERT INTO combo_products (combo_id, product_id, uuid, quantity)
        VALUES (${comboId}, ${sqlValue(ids[k])}, ${sqlValue(uuids[k] ?? null)}, ${sqlValue(qty[k] ?? null)})`;
    }
  }
}

/** PromotionService::create */
export async function createPromotion(raw: Input) {
  const req = laravelInput(raw);
  await db.$transaction(async (tx) => {
    const payload = payloadOf(req);
    const t = sqlDate(now());
    const cols = Object.keys(payload).filter((k) => COLUMNS.has(k));
    const names = Prisma.raw(cols.map((c) => `\`${c}\``).concat(["`created_at`", "`updated_at`"]).join(", "));
    const values = Prisma.join([...cols.map((c) => sqlValue(payload[c])), t, t]);
    await tx.$executeRaw`INSERT INTO promotions (${names}) VALUES (${values})`;
    const [{ id }] = await tx.$queryRaw<{ id: bigint }[]>`SELECT LAST_INSERT_ID() AS id`;
    if (id > 0) await handleRelation(tx, req, BigInt(id), "create");
  });
}

/** PromotionService::update */
export async function updatePromotion(id: bigint, raw: Input) {
  const req = laravelInput(raw);
  await db.$transaction(async (tx) => {
    const payload = payloadOf(req);
    const found = await tx.$queryRaw<{ id: bigint }[]>`SELECT id FROM promotions WHERE id = ${id} AND deleted_at IS NULL`;
    if (!found.length) throw new Error("No query results for model [App\\Models\\Promotion]");
    const cols = Object.keys(payload).filter((k) => COLUMNS.has(k));
    const sets = Prisma.join(
      [...cols.map((c) => Prisma.sql`${Prisma.raw(`\`${c}\``)} = ${sqlValue(payload[c])}`), Prisma.sql`updated_at = ${sqlDate(now())}`],
      ", ",
    );
    await tx.$executeRaw`UPDATE promotions SET ${sets} WHERE id = ${id}`;
    await handleRelation(tx, req, id, "update");
  });
}

/** PromotionService::destroy — xoa mem (SoftDeletes). */
export async function destroyPromotion(id: bigint) {
  const n = await db.$executeRaw`UPDATE promotions SET deleted_at = ${sqlDate(now())}, updated_at = ${sqlDate(now())} WHERE id = ${id} AND deleted_at IS NULL`;
  if (!n) throw new Error("No query results for model [App\\Models\\Promotion]");
}

/** SourceRepository::all() */
export async function allSources() {
  return db.$queryRaw<{ id: bigint; name: string }[]>`SELECT id, name FROM sources WHERE deleted_at IS NULL ORDER BY id`;
}
