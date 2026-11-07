import { ArrowDownRightIcon, ArrowUpRightIcon, BarChart3Icon, CalendarIcon, PackageIcon, ShoppingCartIcon, UsersIcon, WalletIcon } from "lucide-react";
import Link from "next/link";
import { EmptyRow, PageHeader } from "@/components/admin/page";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/form-controls";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/misc";
import { addMoney, formatMoney, subMoney, toCents } from "@/lib/money";
import { cn } from "@/lib/utils";
import { param, type SearchParams } from "@/server/admin-list";
import { requireAdmin } from "@/server/auth";
import { orderStatistic, reportCustomer, reportProduct, reportTime, reportTotalRevenue, growth } from "@/modules/order/order";
import { customerStatistic } from "@/modules/customer/customer";
import { ReportChart } from "./report-chart";

/**
 * ReportController (time/product/customer) + view backend/report/*.blade.php
 * va backend/dashboard/component/statistic.blade.php. Ban goc khong goi authorize().
 * Ngay gui len dang Y-m-d (input date); parseDate() van nhan d/m/Y cua link cu.
 */

function StatCard({ title, value, icon, children }: { title: string; value: React.ReactNode; icon: React.ReactNode; children?: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="grid gap-1 pt-5">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          {title}
          <span className="text-muted-foreground [&>svg]:size-4">{icon}</span>
        </div>
        <div className="text-2xl font-semibold tabular-nums">{value}</div>
        <div className="text-xs text-muted-foreground">{children}</div>
      </CardContent>
    </Card>
  );
}

/** dashboard/component/statistic.blade.php */
export async function Statistic() {
  const [o, c] = await Promise.all([orderStatistic(), customerStatistic()]);
  const up = Number(o.grow.replace(/,/g, "")) > 0;
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard title="Đơn hàng trong tháng" value={o.orderCurrentMonth} icon={<ShoppingCartIcon />}>
        <span className={cn("inline-flex items-center gap-0.5 font-medium", up ? "text-success" : "text-destructive")}>
          {up ? <ArrowUpRightIcon className="size-3" /> : <ArrowDownRightIcon className="size-3" />}
          {o.grow}%
        </span>{" "}
        so với tháng trước
      </StatCard>
      <StatCard title="Tổng số đơn hàng" value={o.totalOrders} icon={<PackageIcon />}>
        Số đơn hủy {o.cancleOrders} · {growth(o.totalOrders, o.cancleOrders)}%
      </StatCard>
      <StatCard title="Tổng doanh thu" value={formatMoney(o.revenue)} icon={<WalletIcon />}>
        Đơn đã thanh toán
      </StatCard>
      <StatCard title="Tổng số khách hàng" value={c.totalCustomers} icon={<UsersIcon />}>
        Khách hàng đang hoạt động
      </StatCard>
    </div>
  );
}

/** date("Y-m-d H:i:s", strtotime(str_replace('/', '-', $date))): d/m/Y -> Y-m-d. */
function parseDate(s: string): string {
  const v = s.replace(/\//g, "-").trim();
  let m = v.match(/^(\d{1,2})-(\d{1,2})-(\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")} 00:00:00`;
  m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")} 00:00:00`;
  return "1970-01-01 00:00:00"; // strtotime() false -> date(..., false) = 1970-01-01
}

type Kind = "time" | "product" | "customer";

const CONFIG: Record<Kind, { title: string; heads: string[]; td: string[]; label: string }> = {
  time: {
    title: "Báo cáo doanh thu theo thời gian",
    heads: ["Ngày", "SL khách hàng", "SL đơn", "Tiền hàng ($)", "Tổng chiết khấu ($)", "Doanh thu ($)"],
    td: ["order_date", "count_customer", "count_order", "sum_revenue|format", "sum_discount|format"],
    label: "order_date",
  },
  product: {
    title: "Báo cáo doanh thu theo sản phẩm",
    heads: ["SKU", "Tên SP", "SL khách", "SL hàng bán", "Tiền hàng ($)", "Tổng chiết khấu ($)", "Doanh thu ($)"],
    td: ["sku", "product_name", "count_customer", "count_order", "sum_revenue|format", "sum_discount|format"],
    label: "product_name",
  },
  customer: {
    title: "Báo cáo doanh thu theo nguồn khách",
    heads: ["Tên nguồn", "SL khách", "SL đơn", "Tiền hàng ($)", "Tổng chiết khấu ($)", "Doanh thu ($)", "Tỉ lệ"],
    td: ["source_name", "count_customer", "count_order", "sum_revenue|format", "sum_discount|format"],
    label: "source_name",
  },
};

const TABS: { kind: Kind; label: string }[] = [
  { kind: "time", label: "Theo thời gian" },
  { kind: "product", label: "Theo sản phẩm" },
  { kind: "customer", label: "Theo nguồn khách" },
];

/** Hien thi gia tri nhu Blade {{ }} (Date -> Y-m-d, so -> chuoi). */
function show(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v);
}

/** round($rate, 1) cua PHP roi noi '%' */
function phpRound1(n: number) {
  if (!Number.isFinite(n)) return Number.isNaN(n) ? "NAN" : n > 0 ? "INF" : "-INF";
  const r = Math.round(n * 10) / 10;
  return String(r);
}

/** Gia tri cho <input type=date>: nhan Y-m-d hoac d/m/Y. */
function toInputDate(s: string) {
  if (!s) return "";
  const d = parseDate(s).slice(0, 10);
  return d === "1970-01-01" ? "" : d;
}

export async function ReportPage({ kind, searchParams: sp }: { kind: Kind; searchParams: SearchParams }) {
  await requireAdmin();
  const cfg = CONFIG[kind];
  const startInput = param(sp, "startDate") ?? "";
  const endInput = param(sp, "endDate") ?? "";
  let reports: Record<string, unknown>[] = [];
  let totalSumary = 0;
  if (startInput) {
    const start = parseDate(startInput);
    const end = parseDate(endInput);
    if (kind === "time") reports = await reportTime(start, end);
    if (kind === "product") reports = await reportProduct(start, end);
    if (kind === "customer") {
      const total = await reportTotalRevenue(start, end);
      totalSumary = subMoney(total.sum_revenue, total.sum_discount);
      reports = await reportCustomer(start, end);
    }
  }
  const revenueOf = (val: Record<string, unknown>) => subMoney(val.sum_revenue, val.sum_discount);
  const chart = reports.map((val) => ({ label: show(val[cfg.label]) || "(không rõ)", revenue: revenueOf(val) }));
  const sum = addMoney(...reports.map(revenueOf));
  const qs = startInput ? `?${new URLSearchParams({ startDate: startInput, endDate: endInput })}` : "";

  return (
    <>
      <PageHeader title={cfg.title} crumbs={[{ label: "Báo cáo" }, { label: cfg.title }]} />
      <div className="grid gap-5">
        <Statistic />
        <div className="flex flex-wrap gap-1 rounded-lg border bg-card p-1 sm:w-fit">
          {TABS.map((t) => (
            <Link
              key={t.kind}
              href={`/report/${t.kind}${qs}`}
              className={cn("rounded-md px-3 py-1.5 text-sm transition-colors", t.kind === kind ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground")}
            >
              {t.label}
            </Link>
          ))}
        </div>
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Chọn khoảng thời gian</CardTitle>
              <CardDescription>Chỉ tính các đơn hàng đã thanh toán.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <form action={`/report/${kind}`} method="get" className="flex flex-wrap items-end gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="startDate">
                  Ngày bắt đầu <span className="text-destructive">*</span>
                </Label>
                <Input type="date" id="startDate" name="startDate" required defaultValue={toInputDate(startInput)} className="w-44" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="endDate">
                  Ngày kết thúc <span className="text-destructive">*</span>
                </Label>
                <Input type="date" id="endDate" name="endDate" required defaultValue={toInputDate(endInput)} className="w-44" />
              </div>
              <Button type="submit">
                <CalendarIcon /> Xem báo cáo
              </Button>
            </form>
          </CardContent>
        </Card>
        {startInput && reports.length > 0 && (
          <Card>
            <CardHeader>
              <div>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3Icon className="size-4" /> Biểu đồ doanh thu
                </CardTitle>
                <CardDescription>Tổng doanh thu: {formatMoney(sum)}</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <ReportChart data={chart} />
            </CardContent>
          </Card>
        )}
        <Card>
          <CardHeader>
            <CardTitle>Chi tiết</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  {cfg.heads.map((h, i) => (
                    <TableHead key={h} className={i === 0 || (kind === "product" && i === 1) ? "" : "text-right"}>
                      {h}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.length === 0 && (
                  <EmptyRow colSpan={cfg.heads.length} text={startInput ? "Không có dữ liệu trong khoảng thời gian này." : "Chọn khoảng thời gian để xem báo cáo."} />
                )}
                {reports.map((val, i) => {
                  const revenue = revenueOf(val);
                  const total = formatMoney(revenue);
                  return (
                    <TableRow key={i}>
                      {cfg.td.map((item, j) => {
                        const [field, format] = item.split("|");
                        const value = format === "format" ? formatMoney(val[field]) : show(val[field]);
                        return (
                          <TableCell key={item} className={j === 0 || (kind === "product" && j === 1) ? "" : "text-right tabular-nums"}>
                            {value}
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-right font-medium tabular-nums">{total}</TableCell>
                      {kind === "customer" && (
                        <TableCell className="text-right tabular-nums">{phpRound1((toCents(revenue) / toCents(totalSumary)) * 100)}%</TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
