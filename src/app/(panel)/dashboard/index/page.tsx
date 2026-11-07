import { BanknoteIcon, ShoppingCartIcon, TrendingDownIcon, TrendingUpIcon, UsersIcon, XCircleIcon } from "lucide-react";
import Link from "next/link";
import { EmptyRow, ListCard, PageHeader } from "@/components/admin/page";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/misc";
import { convertDateTime } from "@/lib/helpers";
import { cn } from "@/lib/utils";
import { NewsDashboard } from "@/modules/dashboard/news";
import { RevenueChart } from "@/modules/dashboard/revenue-chart";
import { getSiteType } from "@/modules/system/site-type";
import { customerStatistic, growth, newOrders, orderStatistic, priceFormat } from "@/modules/dashboard/statistic";

export const metadata = { title: "Dashboard" };

/**
 * GET /dashboard/index — DashboardController@index
 * view: backend/dashboard/home/index.blade.php (statistic + chart + order).
 * Controller goc khong goi authorize().
 */
function parseJson(v: string | null): Record<string, unknown> {
  if (!v) return {};
  try {
    const o = JSON.parse(v);
    return o && typeof o === "object" ? o : {};
  } catch {
    return {};
  }
}

function StatCard({ title, value, icon: Icon, tone, children }: { title: string; value: React.ReactNode; icon: React.ElementType; tone: string; children?: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-medium text-muted-foreground">{title}</div>
          <div className="mt-1 truncate text-2xl font-semibold tabular-nums">{value}</div>
          {children && <div className="mt-1 text-xs text-muted-foreground">{children}</div>}
        </div>
        <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg", tone)}>
          <Icon className="size-5" />
        </span>
      </CardContent>
    </Card>
  );
}

export default async function DashboardIndex() {
  // Website tin tuc: dashboard theo bai viet / luot xem / lien he
  if ((await getSiteType()) === "news")
    return (
      <>
        <PageHeader title="Tổng quan" description="Bài viết, lượt xem và liên hệ" />
        <NewsDashboard />
      </>
    );
  const [order, customer, orders] = await Promise.all([orderStatistic(), customerStatistic(), newOrders()]);
  const year = new Date(Date.now() + 7 * 3600_000).getUTCFullYear();
  const up = Number(order.grow.replaceAll(",", "")) > 0;

  return (
    <>
      <PageHeader title="Tổng quan" description="Số liệu đơn hàng, doanh thu và khách hàng" />

      {/* component/statistic.blade.php */}
      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Đơn hàng trong tháng" value={order.orderCurrentMonth} icon={ShoppingCartIcon} tone="bg-primary/10 text-primary">
          <span className={cn("inline-flex items-center gap-1 font-medium", up ? "text-success" : "text-destructive")}>
            {up ? <TrendingUpIcon className="size-3.5" /> : <TrendingDownIcon className="size-3.5" />}
            {order.grow}%
          </span>{" "}
          so với tháng trước
        </StatCard>
        <StatCard title="Tổng số đơn hàng" value={order.totalOrders} icon={XCircleIcon} tone="bg-amber-500/10 text-amber-600">
          Số đơn hủy {order.cancleOrders} — chiếm {growth(order.totalOrders, order.cancleOrders)}%
        </StatCard>
        <StatCard title="Tổng doanh thu" value={priceFormat(order.revenue)} icon={BanknoteIcon} tone="bg-success/10 text-success">
          Đơn đã thanh toán
        </StatCard>
        <StatCard title="Tổng số khách hàng" value={customer.totalCustomers} icon={UsersIcon} tone="bg-destructive/10 text-destructive">
          Khách hàng đã đăng ký
        </StatCard>
      </div>

      {/* component/chart.blade.php */}
      <Card className="mb-5">
        <CardHeader>
          <div>
            <CardTitle>Biểu đồ doanh thu năm {year}</CardTitle>
            <CardDescription>Doanh thu từ các đơn đã thanh toán</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <RevenueChart initial={{ label: order.revenueChart.label, data: order.revenueChart.data }} />
        </CardContent>
      </Card>

      {/* component/order.blade.php */}
      <ListCard title="Danh sách đơn hàng mới" description="Đơn tạo trong hôm nay. Tổng cuối là tổng chưa bao gồm giảm giá.">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mã</TableHead>
              <TableHead>Ngày tạo</TableHead>
              <TableHead>Khách hàng</TableHead>
              <TableHead className="text-right">Giảm giá (USD)</TableHead>
              <TableHead className="text-right">Tổng cuối (USD)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.length === 0 && <EmptyRow colSpan={5} text="Hôm nay chưa có đơn hàng mới." />}
            {orders.map((o) => {
              const promotion = parseJson(o.promotion);
              const cart = parseJson(o.cart);
              return (
                <TableRow key={o.id.toString()}>
                  <TableCell>
                    <Link href={`/order/${o.id}/detail`} className="font-medium text-primary hover:underline">
                      {o.code}
                    </Link>
                  </TableCell>
                  <TableCell>{convertDateTime(o.created_at, "d-m-Y")}</TableCell>
                  <TableCell>{o.fullname}</TableCell>
                  <TableCell className="text-right tabular-nums">{priceFormat(promotion.discount ?? null)}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{priceFormat(cart.cartTotal ?? null)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </ListCard>
    </>
  );
}
