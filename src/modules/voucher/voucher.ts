import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { now } from "@/lib/helpers";
import { moneyNumber, parseMoneyOrZero } from "@/lib/money";
import type { Input } from "@/lib/http";
import { listParams, type SearchParams } from "@/server/admin-list";
import { dataGet, laravelInput, only, parseDmyHi, sqlDate } from "@/modules/promotion/php";

/** VoucherRepository + VoucherService (app/Services/V1/Product/VoucherService.php), VoucherEnum. */
export const VoucherEnum = {
  PRODUCT_VOUCHER: "PRODUCT_VOUCHER",
  ALL_PRODUCTS: "ALL_PRODUCTS",
  SPECIFIC_PRODUCTS: "SPECIFIC_PRODUCTS",
  SHIPPING_ORDERS: "SHIPPING_ORDERS",
  TOTAL_ORDERS: "TOTAL_ORDERS",
  COMBINE_PROMOTION: 1,
} as const;

export type VoucherRow = {
  id: bigint;
  code: string;
  name: string;
  description: string | null;
  discount_type: string;
  discount_value: number;
  max_discount_amount: number | null;
  product_scope: string;
  total_quantity: number;
  used_quantity: number;
  start_date: Date;
  end_date: Date;
  max_usage_per_user: number;
  combine_promotion: number;
  method: string;
};

/** Cot DECIMAL (Prisma.Decimal) -> number 2 chu so: JSON/ajax/gio hang van nhan so. */
function moneyVoucher(v: VoucherRow): VoucherRow {
  return {
    ...v,
    discount_value: moneyNumber(v.discount_value),
    max_discount_amount: v.max_discount_amount === null ? null : moneyNumber(v.max_discount_amount),
  };
}

const SELECT = Prisma.sql`SELECT id, code, name, description, discount_type, discount_value, max_discount_amount, product_scope,
  total_quantity, used_quantity, start_date, end_date, max_usage_per_user, combine_promotion, method FROM vouchers`;

/**
 * VoucherRepository::voucherPagination — keyword theo code/name, publish (bang
 * vouchers khong co cot publish: ban goc loi SQL neu loc publish), KHONG sap xep.
 */
export async function paginateVouchers(sp: SearchParams) {
  const { perPage, page, offset, keyword } = listParams(sp);
  const cond = keyword
    ? Prisma.sql`WHERE (code LIKE ${`%${keyword}%`} OR name LIKE ${`%${keyword}%`}) AND deleted_at IS NULL`
    : Prisma.sql`WHERE deleted_at IS NULL`;
  const [rows, count] = await Promise.all([
    db.$queryRaw<VoucherRow[]>`${SELECT} ${cond} LIMIT ${perPage} OFFSET ${offset}`,
    db.$queryRaw<{ c: bigint }[]>`SELECT COUNT(*) AS c FROM vouchers ${cond}`,
  ]);
  return { rows: rows.map(moneyVoucher), total: Number(count[0].c), perPage, page };
}

export async function findVoucher(id: bigint): Promise<VoucherRow | null> {
  const rows = await db.$queryRaw<VoucherRow[]>`${SELECT} WHERE id = ${id} AND deleted_at IS NULL LIMIT 1`;
  return rows[0] ? moneyVoucher(rows[0]) : null;
}

/** voucher_order_conditions / voucher_shipping_conditions (hasOne) */
export async function voucherConditions(id: bigint) {
  const [order, shipping] = await Promise.all([
    db.$queryRaw<{ min_order_value: number; max_order_value: number | null }[]>`
      SELECT min_order_value, max_order_value FROM voucher_order_conditions WHERE voucher_id = ${id} AND deleted_at IS NULL ORDER BY id LIMIT 1`,
    db.$queryRaw<{ min_shipping_value: number; max_shipping_value: number | null }[]>`
      SELECT min_shipping_value, max_shipping_value FROM voucher_shipping_conditions WHERE voucher_id = ${id} AND deleted_at IS NULL ORDER BY id LIMIT 1`,
  ]);
  const o = order[0];
  const sh = shipping[0];
  const n = (v: unknown) => (v === null || v === undefined ? null : moneyNumber(v));
  return {
    order: o ? { min_order_value: moneyNumber(o.min_order_value), max_order_value: n(o.max_order_value) } : null,
    shipping: sh ? { min_shipping_value: moneyNumber(sh.min_shipping_value), max_shipping_value: n(sh.max_shipping_value) } : null,
  };
}

/** VoucherController@edit: $object['id'][], $object['name'][] tu voucher_products. */
export async function voucherObject(id: bigint) {
  const rows = await db.$queryRaw<{ id: bigint; name: string | null }[]>`
    SELECT p.id, (SELECT pl.name FROM product_language pl WHERE pl.product_id = p.id LIMIT 1) AS name
    FROM voucher_products vp JOIN products p ON p.id = vp.product_id
    WHERE vp.voucher_id = ${id} AND p.deleted_at IS NULL ORDER BY vp.id`;
  if (!rows.length) return null;
  return { id: rows.map((r) => Number(r.id)), name: rows.map((r) => r.name) };
}

/* ------------------------------ Service ------------------------------ */

type Arr = Record<string, unknown>;
const listOf = (v: unknown): unknown[] => (Array.isArray(v) ? v : v && typeof v === "object" ? Object.values(v) : []);

/** VoucherService::request() */
function payloadOf(req: Input) {
  const payload: Arr = only(req, [
    "name", "code", "description", "total_quantity", "max_usage_per_user", "combine_promotion", "start_date", "end_date", "method", "product_scope",
  ]);
  const type = String(req.method ?? "");
  payload.code = payload.code && payload.code !== "0" ? payload.code : Math.floor(Date.now() / 1000);
  // USD co xu: "24.99", "1,234.50", "$24.99" -> "1234.50" (ban VND: convert_price bo dau cham).
  // discount_type = PERCENTAGE thi discount_value la %.
  payload.discount_value = parseMoneyOrZero(dataGet(req, `${type}.discount_value`));
  payload.max_discount_amount = parseMoneyOrZero(dataGet(req, `${type}.max_discount_amount`));
  payload.discount_type = dataGet(req, `${type}.discount_type`) ?? null;
  const start = parseDmyHi(payload.start_date);
  const end = parseDmyHi(payload.end_date);
  // Carbon::createFromFormat nem exception neu sai dinh dang -> service bat loi
  if (!start || !end) throw new Error("Carbon: ngay khong dung dinh dang d/m/Y H:i");
  payload.start_date = sqlDate(start);
  payload.end_date = sqlDate(end);
  if (payload.combine_promotion === undefined || payload.combine_promotion === null) payload.combine_promotion = 0;
  if (type === VoucherEnum.PRODUCT_VOUCHER) payload.product_scope = req.product_scope ?? null;
  return payload;
}

const COLUMNS = [
  "name", "code", "description", "total_quantity", "max_usage_per_user", "combine_promotion", "start_date", "end_date",
  "method", "product_scope", "discount_value", "max_discount_amount", "discount_type",
];
const val = (v: unknown) => (v === null || v === undefined ? null : typeof v === "object" ? JSON.stringify(v) : (v as string | number));

async function handleRelation(tx: Prisma.TransactionClient, req: Input, voucherId: bigint, method: "create" | "update") {
  const type = String(req.method ?? "");
  if (type === VoucherEnum.PRODUCT_VOUCHER) {
    // handleVoucherProduct: detach (update) + sync
    const object = req.object as Arr | null | undefined;
    await tx.$executeRaw`DELETE FROM voucher_products WHERE voucher_id = ${voucherId}`;
    if (object !== null && object !== undefined) {
      for (const productId of listOf(object.id)) {
        await tx.$executeRaw`INSERT INTO voucher_products (voucher_id, product_id) VALUES (${voucherId}, ${val(productId)})`;
      }
    }
    return;
  }
  // handleVoucherOrder: TOTAL_ORDERS -> order, con lai -> shipping
  const kind = type === VoucherEnum.TOTAL_ORDERS ? "order" : "shipping";
  const min = parseMoneyOrZero(dataGet(req, `${type}.min_${kind}_value`));
  const max = parseMoneyOrZero(dataGet(req, `${type}.max_${kind}_value`));
  if (method === "update") {
    await tx.$executeRaw`DELETE FROM voucher_shipping_conditions WHERE voucher_id = ${voucherId}`;
    await tx.$executeRaw`DELETE FROM voucher_order_conditions WHERE voucher_id = ${voucherId}`;
  }
  // ->insert() cua query builder: khong ghi created_at/updated_at
  if (kind === "order") {
    await tx.$executeRaw`INSERT INTO voucher_order_conditions (voucher_id, min_order_value, max_order_value) VALUES (${voucherId}, ${min}, ${max})`;
  } else {
    await tx.$executeRaw`INSERT INTO voucher_shipping_conditions (voucher_id, min_shipping_value, max_shipping_value) VALUES (${voucherId}, ${min}, ${max})`;
  }
}

/** VoucherService::create */
export async function createVoucher(raw: Input) {
  const req = laravelInput(raw);
  await db.$transaction(async (tx) => {
    const payload = payloadOf(req);
    const t = sqlDate(now());
    const cols = COLUMNS.filter((c) => c in payload);
    const names = Prisma.raw(cols.map((c) => `\`${c}\``).concat(["`created_at`", "`updated_at`"]).join(", "));
    await tx.$executeRaw`INSERT INTO vouchers (${names}) VALUES (${Prisma.join([...cols.map((c) => val(payload[c])), t, t])})`;
    const [{ id }] = await tx.$queryRaw<{ id: bigint }[]>`SELECT LAST_INSERT_ID() AS id`;
    if (id > 0) await handleRelation(tx, req, BigInt(id), "create");
  });
}

/** VoucherService::update */
export async function updateVoucher(id: bigint, raw: Input) {
  const req = laravelInput(raw);
  await db.$transaction(async (tx) => {
    const payload = payloadOf(req);
    const found = await tx.$queryRaw<{ id: bigint }[]>`SELECT id FROM vouchers WHERE id = ${id} AND deleted_at IS NULL`;
    if (!found.length) throw new Error("No query results for model [Voucher]");
    const cols = COLUMNS.filter((c) => c in payload);
    const sets = Prisma.join(
      [...cols.map((c) => Prisma.sql`${Prisma.raw(`\`${c}\``)} = ${val(payload[c])}`), Prisma.sql`updated_at = ${sqlDate(now())}`],
      ", ",
    );
    await tx.$executeRaw`UPDATE vouchers SET ${sets} WHERE id = ${id}`;
    await handleRelation(tx, req, id, "update");
  });
}

/** VoucherService::destroy — forceDelete (cac bang con xoa theo ON DELETE CASCADE). */
export async function destroyVoucher(id: bigint) {
  const n = await db.$executeRaw`DELETE FROM vouchers WHERE id = ${id} AND deleted_at IS NULL`;
  if (!n) throw new Error("No query results for model [Voucher]");
}
