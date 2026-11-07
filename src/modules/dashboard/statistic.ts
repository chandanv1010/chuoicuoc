import "server-only";
import { db } from "@/lib/db";
import { now } from "@/lib/helpers";
import { formatMoney, moneyNumber } from "@/lib/money";

/**
 * OrderService::statistic + CustomerService::statistic + OrderRepository::newOrder
 * (app/Services/V1/Core/OrderService.php, app/Repositories/Core/OrderRepository.php).
 * Order/Customer dung SoftDeletes nen moi truy van deu loc deleted_at IS NULL.
 */

/** growth(): number_format(($cur - $prev) / max($prev,1) * 100, 1) */
export function growth(current: number, previous: number): string {
  const division = previous === 0 ? 1 : previous;
  const grow = ((current - previous) / division) * 100;
  return numberFormat(grow, 1);
}

/** number_format($n, $decimals) mac dinh cua PHP: ',' ngan cach hang nghin, '.' thap phan. */
function numberFormat(n: number, decimals: number): string {
  const fixed = Math.abs(n).toFixed(decimals);
  const [int, dec] = fixed.split(".");
  const withSep = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const sign = n < 0 && Number(fixed) !== 0 ? "-" : "";
  return sign + withSep + (dec ? `.${dec}` : "");
}

/** Ban VND: convert_price($price, true). Storefront: USD co xu -> "$1,234.50" (null -> "$0.00"). */
export function priceFormat(n: unknown): string {
  return formatMoney(n);
}

const count = (rows: { c: bigint | number }[]) => Number(rows[0]?.c ?? 0);

export async function orderStatistic() {
  const t = now(); // gio dia phuong (now() cua Laravel, timezone Asia/Ho_Chi_Minh)
  const month = t.getUTCMonth() + 1;
  const year = t.getUTCFullYear();
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;

  const [cur, prev, total, cancle, revenue, chart] = await Promise.all([
    db.$queryRaw<{ c: bigint }[]>`SELECT COUNT(*) AS c FROM orders WHERE MONTH(created_at) = ${month} AND YEAR(created_at) = ${year} AND deleted_at IS NULL`,
    db.$queryRaw<{ c: bigint }[]>`SELECT COUNT(*) AS c FROM orders WHERE MONTH(created_at) = ${prevMonth} AND YEAR(created_at) = ${prevYear} AND deleted_at IS NULL`,
    db.$queryRaw<{ c: bigint }[]>`SELECT COUNT(*) AS c FROM orders WHERE deleted_at IS NULL`,
    db.$queryRaw<{ c: bigint }[]>`SELECT COUNT(*) AS c FROM orders WHERE confirm = 'cancle' AND deleted_at IS NULL`,
    db.$queryRaw<{ s: unknown }[]>`
      SELECT SUM(order_product.price * order_product.qty) AS s FROM orders
      JOIN order_product ON order_product.order_id = orders.id
      WHERE orders.payment = 'paid' AND orders.deleted_at IS NULL`,
    // revenueByYear: SoftDeletes them "orders.deleted_at is null" vao WHERE (sau LEFT JOIN);
    // thang khong co don van con (NULL IS NULL), thang chi co don da xoa thi mat — giu nguyen.
    db.$queryRaw<{ month: bigint | number; monthly_revenue: unknown }[]>`
      SELECT months.month,
        COALESCE(SUM(JSON_UNQUOTE(JSON_EXTRACT(orders.cart, "$.cartTotal"))), 0) AS monthly_revenue
      FROM (SELECT 1 AS month UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6
            UNION SELECT 7 UNION SELECT 8 UNION SELECT 9 UNION SELECT 10 UNION SELECT 11 UNION SELECT 12) AS months
      LEFT JOIN orders ON months.month = MONTH(orders.created_at)
        AND orders.payment = 'paid' AND YEAR(orders.created_at) = ${year}
      WHERE orders.deleted_at IS NULL
      GROUP BY months.month`,
  ]);
  const orderCurrentMonth = count(cur);
  const orderPreviousMonth = count(prev);
  // convertRevenueChartData: data[] = monthly_revenue, label[] = 'Tháng N'
  const revenueChart = {
    data: chart.map((r) => moneyNumber(r.monthly_revenue)),
    label: chart.map((r) => `Tháng ${Number(r.month)}`),
  };
  return {
    orderCurrentMonth,
    orderPreviousMonth,
    grow: growth(orderCurrentMonth, orderPreviousMonth),
    totalOrders: count(total),
    cancleOrders: count(cancle),
    revenue: moneyNumber(revenue[0]?.s),
    revenueChart,
  };
}

export async function customerStatistic() {
  const rows = await db.$queryRaw<{ c: bigint }[]>`SELECT COUNT(*) AS c FROM customers WHERE deleted_at IS NULL`;
  return { totalCustomers: count(rows) };
}

export type NewOrder = {
  id: bigint;
  code: string | null;
  created_at: Date | null;
  fullname: string | null;
  promotion: string | null;
  cart: string | null;
};

/** OrderRepository::newOrder(hom nay 00:00:00 -> 23:59:59) */
export async function newOrders() {
  const t = now();
  const day = t.toISOString().slice(0, 10);
  return db.$queryRaw<NewOrder[]>`
    SELECT id, code, created_at, fullname, promotion, cart FROM orders
    WHERE DATE(orders.created_at) >= ${day} AND DATE(orders.created_at) <= ${day} AND deleted_at IS NULL`;
}

/** json_encode() cua PHP: escape '/' va ky tu ngoai ASCII thanh \uXXXX. */
export function phpJson(v: unknown): string {
  return JSON.stringify(v)
    .replace(/\//g, "\\/")
    .replace(/[\u007f-￿]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`);
}
