import "server-only";
import { db } from "@/lib/db";
import { moneyNumber } from "@/lib/money";

/**
 * Truy van don hang / lich su diem cho trang tai khoan khach hang
 * (CustomerController@historyOrder, orderDetail, pointHistory).
 * Cot tien DECIMAL (shipping, price, priceOriginal) doi sang number 2 chu so o day.
 */
const moneyOrder = <T extends { shipping: unknown }>(o: T): T => ({ ...o, shipping: moneyNumber(o.shipping) });
const moneyLine = <T extends { price: unknown; priceOriginal: unknown }>(r: T): T => ({ ...r, price: moneyNumber(r.price), priceOriginal: moneyNumber(r.priceOriginal) });

export type CustomerOrder = {
  id: bigint;
  code: string;
  fullname: string;
  phone: string;
  email: string;
  address: string;
  description: string | null;
  promotion: string | null;
  cart: string | null;
  method: string;
  confirm: string;
  payment: string;
  delivery: string;
  shipping: number;
  point_added: number;
  point_value: number;
  point_used: number;
  created_at: Date | null;
  updated_at: Date | null;
  province_name: string | null;
  district_name: string | null;
  ward_name: string | null;
};

const ORDER_PER_PAGE = 10;

export async function paginateCustomerOrders(customerId: bigint, page: number) {
  const [rows, count] = await Promise.all([
    db.$queryRaw<CustomerOrder[]>`
      SELECT orders.id, orders.code, orders.fullname, orders.phone, orders.email, orders.address, orders.description,
        orders.promotion, orders.cart, orders.method, orders.confirm, orders.payment, orders.delivery, orders.shipping,
        orders.point_added, orders.point_value, orders.point_used, orders.created_at, orders.updated_at,
        provinces.name AS province_name, districts.name AS district_name, wards.name AS ward_name
      FROM orders
      LEFT JOIN provinces ON orders.province_id = provinces.code
      LEFT JOIN districts ON orders.district_id = districts.code
      LEFT JOIN wards ON orders.ward_id = wards.code
      WHERE orders.customer_id = ${customerId} AND orders.deleted_at IS NULL
      ORDER BY orders.created_at DESC
      LIMIT ${ORDER_PER_PAGE} OFFSET ${(page - 1) * ORDER_PER_PAGE}`,
    db.$queryRaw<{ c: bigint }[]>`SELECT COUNT(*) AS c FROM orders WHERE customer_id = ${customerId} AND deleted_at IS NULL`,
  ]);
  return { rows: rows.map(moneyOrder), total: Number(count[0].c), perPage: ORDER_PER_PAGE };
}

export async function findCustomerOrder(code: string, customerId: bigint) {
  const rows = await db.$queryRaw<CustomerOrder[]>`
    SELECT orders.id, orders.code, orders.fullname, orders.phone, orders.email, orders.address, orders.description,
      orders.promotion, orders.cart, orders.method, orders.confirm, orders.payment, orders.delivery, orders.shipping,
      orders.point_added, orders.point_value, orders.point_used, orders.created_at, orders.updated_at,
      provinces.name AS province_name, districts.name AS district_name, wards.name AS ward_name
    FROM orders
    LEFT JOIN provinces ON orders.province_id = provinces.code
    LEFT JOIN districts ON orders.district_id = districts.code
    LEFT JOIN wards ON orders.ward_id = wards.code
    WHERE orders.code = ${code} AND orders.customer_id = ${customerId} AND orders.deleted_at IS NULL
    LIMIT 1`;
  return rows[0] ? moneyOrder(rows[0]) : null;
}

export type OrderProductRow = {
  id: bigint;
  product_id: bigint;
  uuid: string | null;
  name: string;
  qty: number;
  price: number;
  priceOriginal: number;
  option: string;
  image: string | null;
};

/** $order->order_products (hasMany) */
export async function orderProducts(orderId: bigint) {
  const rows = await db.$queryRaw<OrderProductRow[]>`
    SELECT op.id, op.product_id, op.uuid, op.name, op.qty, op.price, op.priceOriginal, op.\`option\`, p.image
    FROM order_product op LEFT JOIN products p ON p.id = op.product_id
    WHERE op.order_id = ${orderId} ORDER BY op.id`;
  return rows.map(moneyLine);
}

/** Don cua session('orderSummary') — trang cart/success. */
export async function ordersByIds(ids: bigint[]) {
  if (!ids.length) return [];
  const list = await db.orders.findMany({ where: { id: { in: ids } }, orderBy: { id: "asc" } });
  // $order->products (belongsToMany): chi san pham chua xoa mem
  return Promise.all(
    list.map(async (o) => ({
      order: { ...o, shipping: moneyNumber(o.shipping) },
      products: (await db.$queryRaw<OrderProductRow[]>`
        SELECT op.id, op.product_id, op.uuid, op.name, op.qty, op.price, op.priceOriginal, op.\`option\`, p.image
        FROM products p JOIN order_product op ON op.product_id = p.id
        WHERE op.order_id = ${o.id} AND p.deleted_at IS NULL ORDER BY op.id`).map(moneyLine),
    })),
  );
}

export type PointHistory = {
  id: bigint;
  order_id: bigint | null;
  points: number;
  type: string;
  description: string | null;
  created_at: Date | null;
  order_code: string | null;
};

const POINT_PER_PAGE = 12;

export async function paginatePointHistory(customerId: bigint, page: number) {
  const [rows, count] = await Promise.all([
    db.$queryRaw<PointHistory[]>`
      SELECT h.id, h.order_id, h.points, h.type, h.description, h.created_at, o.code AS order_code
      FROM customer_point_history h LEFT JOIN orders o ON o.id = h.order_id AND o.deleted_at IS NULL
      WHERE h.customer_id = ${customerId}
      ORDER BY h.created_at DESC
      LIMIT ${POINT_PER_PAGE} OFFSET ${(page - 1) * POINT_PER_PAGE}`,
    db.$queryRaw<{ c: bigint }[]>`SELECT COUNT(*) AS c FROM customer_point_history WHERE customer_id = ${customerId}`,
  ]);
  return { rows, total: Number(count[0].c), perPage: POINT_PER_PAGE };
}

/** json cast: chuoi JSON -> mang, khong phai mang -> [] */
export function jsonArray(s: string | null | undefined): Record<string, unknown> {
  try {
    const v = JSON.parse(s ?? "null");
    return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
