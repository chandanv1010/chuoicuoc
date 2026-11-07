import "server-only";
import { Prisma, type orders } from "@prisma/client";
import { db } from "@/lib/db";
import { now } from "@/lib/helpers";
import { addMoney, moneyNumber, parseMoney, subMoney, toCents } from "@/lib/money";
import { listParams, param, type SearchParams } from "@/server/admin-list";
import cart from "@/lang/vn/cart.json";

/**
 * OrderRepository + OrderService (app/Repositories/Core/OrderRepository.php,
 * app/Services/V1/Core/OrderService.php) va Ajax\OrderController@update.
 * Tien USD co xu: cot DECIMAL (shipping, price, priceOriginal) doi sang number 2 chu so
 * ngay khi doc (moneyNumber) de trang/JSON van nhan so.
 */

/** Cot JSON (cast 'json' cua model Order) */
export function parseJson<T = Record<string, unknown>>(v: string | null | undefined): T | null {
  if (!v) return null;
  try {
    return JSON.parse(v) as T;
  } catch {
    return null;
  }
}

/** So tu JSON/chuoi (PHP tu ep kieu khi cong tru). */
export function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Carbon->toJSON(): Laravel ghi gio dia phuong (UTC+7) vao DB, khi serialize
 * thi doi ve UTC dang 2023-10-12T17:19:23.000000Z.
 */
export function laravelJsonDate(d: Date | null | undefined): string | null {
  if (!d) return null;
  return `${new Date(d.getTime() - 7 * 3600_000).toISOString().slice(0, 19)}.000000Z`;
}

/** Gio hien tai cua Laravel (Asia/Ho_Chi_Minh) duoi dang cac thanh phan. */
export function localNow() {
  const d = now();
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(), date: d };
}

export type OrderListRow = {
  id: bigint;
  code: string;
  fullname: string;
  phone: string;
  email: string;
  address: string;
  promotion: string | null;
  cart: string | null;
  method: string;
  confirm: string;
  payment: string;
  delivery: string;
  shipping: number;
  created_at: Date | null;
};

/** 'm/d/Y' -> 'Y-m-d' (scopeCustomerCreatedAt). Sai dinh dang thi null. */
function mdy(s: string | undefined): string | null {
  const m = (s ?? "").trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
}

/**
 * OrderService::paginate + OrderRepository::pagination.
 * Giu nguyen thu tu where cua Eloquent (keyword dung orWhere khong boc ngoac,
 * orWhereHas('products') luon duoc them ca khi keyword rong) — SoftDeletes boc
 * toan bo dieu kien trong ngoac roi AND deleted_at IS NULL.
 */
export async function paginateOrders(sp: SearchParams) {
  const { perPage, page, offset, keyword } = listParams(sp);
  const like = `%${keyword}%`;
  const parts: Prisma.Sql[] = [];
  if (keyword) {
    for (const f of ["fullname", "phone", "email", "address", "code"]) {
      parts.push(Prisma.sql`${Prisma.raw(`orders.\`${f}\``)} LIKE ${like}`);
    }
  }
  // orWhereHas('products', name LIKE) — 'name' chi co o order_product
  parts.push(
    Prisma.sql`EXISTS (SELECT 1 FROM products INNER JOIN order_product ON products.id = order_product.product_id
      WHERE orders.id = order_product.order_id AND order_product.name LIKE ${like} AND products.deleted_at IS NULL)`,
  );
  let cond = Prisma.join(parts, " OR ");
  const ands: Prisma.Sql[] = [];
  // customDropdownFilter: confirm / payment / delivery
  for (const key of Object.keys(cart)) {
    const v = param(sp, key) ?? "";
    if (v !== "" && v !== "none") ands.push(Prisma.sql`${Prisma.raw(`orders.\`${key}\``)} = ${v}`);
  }
  // customerCreatedAt: "m/d/Y - m/d/Y"
  const createdAt = param(sp, "created_at");
  if (createdAt) {
    const [a, b] = createdAt.split("-").map((x) => x.trim());
    const start = mdy(a);
    const end = mdy(b);
    if (start && end) {
      ands.push(Prisma.sql`DATE(orders.created_at) >= ${start}`);
      ands.push(Prisma.sql`DATE(orders.created_at) <= ${end}`);
    }
  }
  if (ands.length) cond = Prisma.sql`${cond} AND ${Prisma.join(ands, " AND ")}`;
  const where = Prisma.sql`WHERE (${cond}) AND orders.deleted_at IS NULL`;
  const [rows, count] = await Promise.all([
    db.$queryRaw<OrderListRow[]>`
      SELECT orders.id, orders.code, orders.fullname, orders.phone, orders.email, orders.address, orders.promotion,
             orders.cart, orders.method, orders.confirm, orders.payment, orders.delivery, orders.shipping, orders.created_at
      FROM orders ${where}
      ORDER BY orders.id DESC
      LIMIT ${perPage} OFFSET ${offset}`,
    db.$queryRaw<{ c: bigint }[]>`SELECT COUNT(*) AS c FROM orders ${where}`,
  ]);
  return { rows: rows.map((r) => ({ ...r, shipping: moneyNumber(r.shipping) })), total: Number(count[0].c), perPage, page };
}

export type OrderDetail = Omit<orders, "shipping"> & {
  shipping: number;
  province_name: string | null;
  district_name: string | null;
  ward_name: string | null;
};

/** OrderRepository::getOrderById — orders.* + ten tinh/huyen/xa. */
export async function getOrderById(id: bigint) {
  const rows = await db.$queryRaw<OrderDetail[]>`
    SELECT orders.*, provinces.name AS province_name, districts.name AS district_name, wards.name AS ward_name
    FROM orders
    LEFT JOIN provinces ON orders.province_id = provinces.code
    LEFT JOIN districts ON orders.district_id = districts.code
    LEFT JOIN wards ON orders.ward_id = wards.code
    WHERE orders.id = ${id} AND orders.deleted_at IS NULL
    LIMIT 1`;
  return rows[0] ? { ...rows[0], shipping: moneyNumber(rows[0].shipping) } : null;
}

export type OrderItem = {
  product_id: bigint;
  image: string | null;
  uuid: string | null;
  name: string;
  qty: number;
  price: number;
  priceOriginal: number;
};

/** $order->products (pivot order_product) + OrderService::getOrderItemImage. */
export async function getOrderItems(orderId: bigint): Promise<OrderItem[]> {
  const items = await db.$queryRaw<OrderItem[]>`
    SELECT products.id AS product_id, products.image, order_product.uuid, order_product.name,
           order_product.qty, order_product.price, order_product.priceOriginal
    FROM products INNER JOIN order_product ON products.id = order_product.product_id
    WHERE order_product.order_id = ${orderId} AND products.deleted_at IS NULL`;
  for (const item of items) {
    item.price = moneyNumber(item.price);
    item.priceOriginal = moneyNumber(item.priceOriginal);
    if (item.uuid !== null) {
      const variant = await db.product_variants.findFirst({ where: { uuid: item.uuid, deleted_at: null }, orderBy: { id: "desc" } });
      // explode(',', $variant->album)[0] ?? null
      item.image = variant ? (variant.album ?? "").split(",")[0] : null;
    }
  }
  return items;
}

const FILLABLE = [
  "code",
  "fullname",
  "phone",
  "email",
  "province_id",
  "district_id",
  "ward_id",
  "address",
  "description",
  "promotion",
  "cart",
  "customer_id",
  "guest_cookie",
  "method",
  "confirm",
  "payment",
  "delivery",
  "shipping",
  "seller_id",
  "point_value",
  "point_added",
  "point_used",
  "point_used_deducted",
] as const;

/** Model Order khi tra ve JSON (cast cart/promotion json, ngay dang ISO UTC). */
function serializeOrder(o: OrderDetail, buyers: unknown) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) {
    if (typeof v === "bigint") out[k] = Number(v);
    else if (k === "shipping") out[k] = moneyNumber(v);
    else if (v instanceof Date) out[k] = laravelJsonDate(v);
    else out[k] = v;
  }
  out.cart = parseJson(o.cart);
  out.promotion = parseJson(o.promotion);
  out.point_added = o.point_added ? 1 : 0;
  out.buyers = buyers;
  return out;
}

class UpdateError extends Error {}

/**
 * POST ajax/order/update — Ajax\OrderController@update.
 * Cap nhat payload (chi cot fillable) roi cong/tru/hoan diem cho khach.
 * Ban goc: don khong co khach (customer_id null / khach da xoa) -> nem loi va
 * rollback ca cap nhat (giu nguyen hanh vi).
 */
export async function updateOrder(id: string, payload: Record<string, unknown>) {
  if (!/^\d+$/.test(id)) return { error: 11, messages: "Cập nhật dữ liệu thất bại" };
  const orderId = BigInt(id);
  try {
    const result = await db.$transaction(async (tx) => {
      const exists = await tx.orders.findFirst({ where: { id: orderId, deleted_at: null } });
      if (!exists) throw new UpdateError(`No query results for model [App\\Models\\Order] ${id}`);
      // $model->fill($payload)->save(): chi cap nhat khi co thay doi (dirty)
      const sets: Prisma.Sql[] = [];
      for (const key of FILLABLE) {
        if (!(key in payload)) continue;
        const raw = payload[key];
        let value = raw === undefined || raw === null || raw === "" ? null : String(raw); // ConvertEmptyStringsToNull
        const current = (exists as unknown as Record<string, unknown>)[key];
        let cur = current === null || current === undefined ? null : typeof current === "boolean" ? (current ? "1" : "0") : String(current);
        // shipping DECIMAL(12,2): nhan "12.5", "$12.50", "1,234.50"
        if (key === "shipping") {
          value = value === null ? null : (parseMoney(value) ?? "0.00");
          cur = parseMoney(current);
        }
        if (cur === value) continue;
        sets.push(Prisma.sql`${Prisma.raw(`\`${key}\``)} = ${value}`);
      }
      if (sets.length) {
        sets.push(Prisma.sql`updated_at = ${now()}`);
        await tx.$executeRaw`UPDATE orders SET ${Prisma.join(sets, ", ")} WHERE id = ${orderId}`;
      }

      const rows = await tx.$queryRaw<OrderDetail[]>`
        SELECT orders.*, provinces.name AS province_name, districts.name AS district_name, wards.name AS ward_name
        FROM orders
        LEFT JOIN provinces ON orders.province_id = provinces.code
        LEFT JOIN districts ON orders.district_id = districts.code
        LEFT JOIN wards ON orders.ward_id = wards.code
        WHERE orders.id = ${orderId} LIMIT 1`;
      // $queryRaw tra tinyint/int dang number|bigint -> ep ve kieu cua model
      const order = {
        ...rows[0],
        shipping: moneyNumber(rows[0].shipping),
        point_added: Boolean(Number(rows[0].point_added)),
        point_value: Number(rows[0].point_value),
        point_used: Number(rows[0].point_used),
        point_used_deducted: Number(rows[0].point_used_deducted),
      };
      const before = { ...order };
      const customer = order.customer_id
        ? await tx.customers.findFirst({ where: { id: order.customer_id, deleted_at: null } })
        : null;
      if (!customer) throw new UpdateError("Không tìm thấy khách hàng.");
      const catalogue = await tx.customer_catalogues.findFirst({ where: { id: customer.customer_catalogue_id, deleted_at: null } });

      // Diem = point_percent% cua tong don (USD), lam tron xuong; 1 diem = POINT_VALUE ($1.00) khi dung
      const totalCents = toCents(parseJson<{ cartTotal?: unknown }>(order.cart)?.cartTotal ?? 0);
      const percent = catalogue?.point_percent ?? 0;
      const pointsEarned = Math.max(0, Math.floor((totalCents * percent) / 100 / 100 + 1e-9));
      let point = customer.point;
      const t = now();
      const history = (points: number, type: string) =>
        tx.customer_point_history.create({
          // 'note' khong nam trong $fillable nen ban goc bo qua -> description null
          data: { customer_id: customer.id, order_id: order.id, points, type, created_at: t, updated_at: t },
        });

      // 1. EARN POINTS
      if (order.payment === "paid" && !order.point_added) {
        point += pointsEarned;
        order.point_value = pointsEarned;
        order.point_added = true;
        await history(pointsEarned, "earn");
      }
      // 2. USE POINTS
      if (order.payment === "paid" && order.point_used > 0 && order.point_used_deducted == 0) {
        point -= order.point_used;
        if (point < 0) point = 0;
        order.point_used_deducted = 1;
        await history(-order.point_used, "use");
      }
      // 3. REVERT POINTS
      if (order.payment !== "paid" && order.point_added) {
        const revertEarn = Math.min(point, order.point_value);
        point -= revertEarn;
        order.point_added = false;
        order.point_value = 0;
        await history(-revertEarn, "revertEarn");
      }
      if (order.payment !== "paid" && order.point_used > 0 && order.point_used_deducted == 1) {
        point += order.point_used;
        order.point_used_deducted = 0;
        await history(order.point_used, "revertUsed");
      }

      if (point !== customer.point) {
        await tx.customers.update({ where: { id: customer.id }, data: { point, updated_at: t } });
      }
      const changed =
        order.point_value !== before.point_value || order.point_added !== before.point_added || order.point_used_deducted !== before.point_used_deducted;
      if (changed) {
        await tx.orders.update({
          where: { id: orderId },
          data: { point_value: order.point_value, point_added: order.point_added, point_used_deducted: order.point_used_deducted, updated_at: t },
        });
        order.updated_at = t;
      }
      const buyers = {
        ...Object.fromEntries(
          Object.entries(customer)
            .filter(([k]) => k !== "password" && k !== "remember_token")
            .map(([k, v]) => [k, typeof v === "bigint" ? Number(v) : v instanceof Date ? laravelJsonDate(v) : v]),
        ),
        customer_catalogues: catalogue
          ? Object.fromEntries(
              Object.entries(catalogue).map(([k, v]) => [k, typeof v === "bigint" ? Number(v) : v instanceof Date ? laravelJsonDate(v) : v]),
            )
          : null,
      };
      return serializeOrder(order, buyers);
    });
    return { error: 10, messages: "Cập nhật đơn hàng thành công", order: result };
  } catch (e) {
    if (!(e instanceof UpdateError)) console.error(e);
    return { error: 11, messages: `Lỗi xử lý: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/* ---------------- Thong ke / bieu do (OrderService::statistic, ajaxOrderChart) ---------------- */

/** growth(): number_format(.., 1) */
export function growth(current: number, previous: number) {
  const division = previous == 0 ? 1 : previous;
  const grow = ((current - previous) / division) * 100;
  return grow.toFixed(1).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export async function orderStatistic() {
  const { month, year } = localNow();
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const byTime = async (m: number, y: number) =>
    Number(
      (
        await db.$queryRaw<{ c: bigint }[]>`
          SELECT COUNT(*) AS c FROM orders WHERE MONTH(created_at) = ${m} AND YEAR(created_at) = ${y} AND deleted_at IS NULL`
      )[0].c,
    );
  const [current, previous, total, cancle, revenue] = await Promise.all([
    byTime(month, year),
    byTime(prevMonth, prevYear),
    db.orders.count({ where: { deleted_at: null } }),
    db.orders.count({ where: { deleted_at: null, confirm: "cancle" } }),
    db.$queryRaw<{ s: unknown }[]>`
      SELECT SUM(order_product.price * order_product.qty) AS s FROM orders
      INNER JOIN order_product ON order_product.order_id = orders.id
      WHERE orders.payment = 'paid' AND orders.deleted_at IS NULL`,
  ]);
  return {
    orderCurrentMonth: current,
    orderPreviousMonth: previous,
    grow: growth(current, previous),
    totalOrders: total,
    cancleOrders: cancle,
    revenue: moneyNumber(revenue[0].s),
  };
}

/** OrderRepository::revenueByYear -> convertRevenueChartData */
async function revenueByYear(year: number) {
  const rows = await db.$queryRaw<{ month: bigint; monthly_revenue: unknown }[]>`
    SELECT months.month, COALESCE(SUM(JSON_UNQUOTE(JSON_EXTRACT(orders.cart, "$.cartTotal"))), 0) AS monthly_revenue
    FROM (SELECT 1 AS month UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6
          UNION SELECT 7 UNION SELECT 8 UNION SELECT 9 UNION SELECT 10 UNION SELECT 11 UNION SELECT 12) AS months
    LEFT JOIN orders ON months.month = MONTH(orders.created_at) AND orders.payment = 'paid'
      AND YEAR(orders.created_at) = ${year} AND orders.deleted_at IS NULL
    GROUP BY months.month`;
  return { data: rows.map((r) => moneyNumber(r.monthly_revenue)), label: rows.map((r) => `Tháng ${r.month}`) };
}

/** GET ajax/order/chart?chartType=1|7|30 */
export async function orderChart(type: number) {
  const { year, month, date } = localNow();
  if (type === 1) return revenueByYear(year);
  if (type === 7) {
    const today = date.toISOString().slice(0, 10); // CURDATE() theo gio Laravel
    const rows = await db.$queryRaw<{ date: Date; daily_revenue: unknown }[]>`
      SELECT dates.date, COALESCE(SUM(JSON_UNQUOTE(JSON_EXTRACT(orders.cart, "$.cartTotal"))), 0) AS daily_revenue
      FROM (SELECT DATE(${today}) - INTERVAL (n.i) DAY AS date FROM
            (SELECT 0 i UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6) n) AS dates
      LEFT JOIN orders ON DATE(orders.created_at) = dates.date AND orders.payment = 'paid' AND orders.deleted_at IS NULL
      GROUP BY dates.date ORDER BY dates.date ASC`;
    return {
      data: rows.map((r) => moneyNumber(r.daily_revenue)),
      label: rows.map((r) => `Ngày ${new Date(r.date).toISOString().slice(0, 10)}`),
    };
  }
  if (type === 30) {
    const rows = await db.$queryRaw<{ day: number; daily_revenue: unknown }[]>`
      SELECT DAY(created_at) AS day, COALESCE(SUM(JSON_UNQUOTE(JSON_EXTRACT(orders.cart, "$.cartTotal"))), 0) AS daily_revenue
      FROM orders WHERE MONTH(created_at) = ${month} AND YEAR(created_at) = ${year} AND deleted_at IS NULL
      GROUP BY day ORDER BY day`;
    const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const label: string[] = [];
    const data: number[] = [];
    for (let d = 1; d <= days; d++) {
      label.push(`Ngày ${d}`);
      const found = rows.find((r) => Number(r.day) === d);
      data.push(found ? moneyNumber(found.daily_revenue) : 0);
    }
    return { label, data };
  }
  return null; // $response chua gan -> ban goc loi "Undefined variable"
}

/* ---------------- Bao cao (OrderRepository::get*ReportTime) ---------------- */

export async function reportTime(start: string, end: string) {
  return db.$queryRaw<Record<string, unknown>[]>`
    SELECT DATE(created_at) AS order_date, COUNT(DISTINCT customer_id) AS count_customer, COUNT(DISTINCT orders.id) AS count_order,
           SUM(order_product.price * order_product.qty) AS sum_revenue,
           (SELECT SUM(JSON_UNQUOTE(JSON_EXTRACT(promotion, '$.discount'))) FROM orders WHERE DATE(created_at) = order_date GROUP BY DATE(created_at)) AS sum_discount
    FROM orders INNER JOIN order_product ON order_product.order_id = orders.id
    WHERE DATE(created_at) >= DATE(${start}) AND DATE(created_at) <= DATE(${end}) AND orders.payment = 'paid' AND orders.deleted_at IS NULL
    GROUP BY order_date`;
}

/** Laravel dat strict=false (khong ONLY_FULL_GROUP_BY) -> o day dung ANY_VALUE() cho cot khong gom nhom. */
export async function reportProduct(start: string, end: string) {
  return db.$queryRaw<Record<string, unknown>[]>`
    SELECT ANY_VALUE(IFNULL(product_variants.sku, products.code)) AS sku, ANY_VALUE(name) AS product_name,
           COUNT(DISTINCT orders.customer_id) AS count_customer, COUNT(orders.id) AS count_order,
           SUM(order_product.price * order_product.qty) AS sum_revenue,
           (SELECT SUM(JSON_UNQUOTE(JSON_EXTRACT(promotion, '$.discount'))) FROM orders WHERE DATE(created_at) = DATE(orders.created_at)) AS sum_discount
    FROM orders INNER JOIN order_product ON order_product.order_id = orders.id
    LEFT JOIN product_variants ON product_variants.uuid = order_product.uuid
    LEFT JOIN products ON products.id = order_product.product_id
    WHERE DATE(orders.created_at) >= DATE(${start}) AND DATE(orders.created_at) <= DATE(${end}) AND orders.payment = 'paid' AND orders.deleted_at IS NULL
    GROUP BY order_product.product_id`;
}

export async function reportCustomer(start: string, end: string) {
  return db.$queryRaw<Record<string, unknown>[]>`
    SELECT sources.name AS source_name, COUNT(DISTINCT orders.customer_id) AS count_customer, COUNT(orders.id) AS count_order,
           SUM(order_product.price * order_product.qty) AS sum_revenue,
           (SELECT SUM(JSON_UNQUOTE(JSON_EXTRACT(promotion, '$.discount')))) AS sum_discount
    FROM orders INNER JOIN customers ON customers.id = orders.customer_id
    INNER JOIN order_product ON order_product.order_id = orders.id
    LEFT JOIN sources ON sources.id = customers.source_id
    WHERE DATE(orders.created_at) >= DATE(${start}) AND DATE(orders.created_at) <= DATE(${end}) AND orders.payment = 'paid' AND orders.deleted_at IS NULL
    GROUP BY sources.id`;
}

export async function reportTotalRevenue(start: string, end: string) {
  const rows = await db.$queryRaw<{ sum_revenue: unknown; sum_discount: unknown }[]>`
    SELECT SUM(order_product.price * order_product.qty) AS sum_revenue,
           (SELECT SUM(JSON_UNQUOTE(JSON_EXTRACT(promotion, '$.discount')))) AS sum_discount
    FROM orders INNER JOIN order_product ON order_product.order_id = orders.id
    WHERE DATE(orders.created_at) >= DATE(${start}) AND DATE(orders.created_at) <= DATE(${end}) AND orders.payment = 'paid' AND orders.deleted_at IS NULL`;
  return rows[0];
}

/** OrderRepository::getOrderByDate — whereBetween('created_at', [startDate, endDate]) (giu nguyen: 2 ngay Y-m-d). */
export async function getOrdersByDate(start: string, end: string) {
  const rows = await db.$queryRaw<
    { code: string; created_at: Date | null; fullname: string; phone: string; address: string; method: string; cart: string | null; promotion: string | null; shipping: unknown }[]
  >`
    SELECT code, created_at, fullname, phone, address, method, cart, promotion, shipping FROM orders
    WHERE created_at BETWEEN ${start} AND ${end} AND deleted_at IS NULL`;
  // Tong cuoi = cartTotal - khuyen mai - voucher + van chuyen (cung cong thuc trang danh sach don)
  return rows.map(({ cart, promotion, shipping, ...o }) => {
    const c = parseJson<{ cartTotal?: unknown; cartVoucher?: unknown }>(cart) ?? {};
    const p = parseJson<{ discount?: unknown }>(promotion) ?? {};
    return { ...o, total: addMoney(subMoney(c.cartTotal, p.discount, c.cartVoucher), shipping) };
  });
}

