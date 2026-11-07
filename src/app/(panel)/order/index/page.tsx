import Link from "next/link";
import { AutoSubmitField } from "@/components/admin/fields";
import { EmptyRow, ListCard, ListToolbar, PageHeader } from "@/components/admin/page";
import { AdminPagination, makePaginator } from "@/components/admin/pagination";
import { Badge, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/misc";
import { __ } from "@/lib/lang";
import { convertDateTime } from "@/lib/helpers";
import { addMoney, formatMoney, subMoney } from "@/lib/money";
import { param, type SearchParams } from "@/server/admin-list";
import { authorize } from "@/server/auth";
import { num, paginateOrders, parseJson } from "@/modules/order/order";
import { ExportExcel } from "@/modules/order/export-modal";
import { DateRangeFilter, OrderBadgeSelect } from "@/modules/order/order-list";
import cart from "@/lang/vn/cart.json";
import payment from "@/lang/vn/payment.json";

export const metadata = { title: "Đơn hàng" };

type Cart = { cartTotal?: unknown; cartVoucher?: unknown };
type Promotion = { discount?: unknown };

const CONFIRM_BADGE: Record<string, "warning" | "success" | "destructive"> = { pending: "warning", confirm: "success", cancle: "destructive" };

/** GET /order/index — OrderController@index (order/index.blade.php + component/filter, table) */
export default async function OrderIndex({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await authorize("order.index");
  const sp = await searchParams;
  const { rows, total, perPage, page } = await paginateOrders(sp);
  const seo = __<{ index: { title: string; table: string } }>("messages.order");
  const cartLang = cart as Record<string, Record<string, string>>;
  const methods = payment.method as { name: string; image: string; title: string }[];
  const opts = (key: string) => Object.entries(cartLang[key]).filter(([k]) => k !== "none");

  return (
    <>
      <PageHeader title={seo.index.title} crumbs={[{ label: seo.index.title }]} actions={<ExportExcel title="Dữ liệu đơn hàng" model="Order" />} />
      <ListCard title={seo.index.table} description="*Tổng cuối là tổng chưa bao gồm giảm giá">
        <ListToolbar action="/order/index" searchParams={sp} publish={false}>
          <DateRangeFilter defaultValue={param(sp, "created_at") ?? ""} />
          {Object.entries(cartLang).map(([key, val]) => {
            const selected = param(sp, key) ?? "";
            return (
              <AutoSubmitField key={key} name={key} defaultValue={selected in val ? selected : "none"} className="w-48">
                {Object.entries(val).map(([index, item]) => (
                  <option key={index} value={index}>
                    {item}
                  </option>
                ))}
              </AutoSubmitField>
            );
          })}
        </ListToolbar>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mã đơn</TableHead>
              <TableHead>Ngày tạo</TableHead>
              <TableHead>Khách hàng</TableHead>
              <TableHead className="text-right">Giảm giá (USD)</TableHead>
              <TableHead className="text-right">Tổng cuối (USD)</TableHead>
              <TableHead className="text-center">Trạng thái</TableHead>
              <TableHead>Thanh toán</TableHead>
              <TableHead>Giao hàng</TableHead>
              <TableHead className="text-center">Hình thức</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && <EmptyRow colSpan={9} text="Không có đơn hàng nào." />}
            {rows.map((order) => {
              const id = order.id.toString();
              const c = parseJson<Cart>(order.cart) ?? {};
              const p = parseJson<Promotion>(order.promotion) ?? {};
              const voucher = c.cartVoucher !== undefined && c.cartVoucher !== null ? num(c.cartVoucher) : 0;
              const ship = order.shipping ?? 0;
              const method = methods.find((m) => m.name === order.method);
              const cancelled = order.confirm === "cancle";
              return (
                <TableRow key={id}>
                  <TableCell>
                    <Link href={`/order/${id}/detail`} className="font-medium text-primary hover:underline">
                      #{order.code}
                    </Link>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{convertDateTime(order.created_at, "d-m-Y")}</TableCell>
                  <TableCell className="min-w-48">
                    <div className="font-medium">{order.fullname}</div>
                    <div className="text-xs text-muted-foreground">{order.phone}</div>
                    <div className="max-w-64 truncate text-xs text-muted-foreground" title={order.address}>
                      {order.address}
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(addMoney(p.discount, voucher))}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{formatMoney(addMoney(subMoney(c.cartTotal, p.discount, voucher), ship))}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant={CONFIRM_BADGE[order.confirm] ?? "outline"}>{cartLang.confirm[order.confirm] ?? order.confirm}</Badge>
                  </TableCell>
                  {(["payment", "delivery"] as const).map((field) => (
                    <TableCell key={field}>
                      {cancelled ? (
                        <span className="text-muted-foreground">-</span>
                      ) : (
                        <OrderBadgeSelect id={id} field={field} value={String(order[field] ?? "")} confirm={order.confirm} options={opts(field)} />
                      )}
                    </TableCell>
                  ))}
                  <TableCell className="text-center">
                    {cancelled || !method ? (
                      <span className="text-muted-foreground">{cancelled ? "-" : order.method || "-"}</span>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img title={method.title} alt={method.title} src={method.image.startsWith("/") || /^https?:/.test(method.image) ? method.image : `/${method.image}`} className="mx-auto h-7 max-w-14 object-contain" />
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <AdminPagination paginator={makePaginator(total, perPage, page, "/order/index", sp)} />
      </ListCard>
    </>
  );
}
