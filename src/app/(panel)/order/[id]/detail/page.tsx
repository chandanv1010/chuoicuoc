import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/page";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/misc";
import { db } from "@/lib/db";
import { __ } from "@/lib/lang";
import { convertDateTime, image } from "@/lib/helpers";
import { addMoney, formatMoney, moneyNumber, mulMoney, subMoney } from "@/lib/money";
import { requireAdmin } from "@/server/auth";
import { getOrderById, getOrderItems, parseJson } from "@/modules/order/order";
import { OrderCustomer, OrderNote, OrderStatusPanel } from "@/modules/order/order-detail";
import cart from "@/lang/vn/cart.json";
import order_ from "@/lang/vn/order.json";
import payment from "@/lang/vn/payment.json";

type Cart = { cartTotal?: unknown; cartVoucher?: unknown };

/**
 * GET /order/{id}/detail — OrderController@detail (order/detail.blade.php + order.js).
 * Ban goc khong goi authorize() o action nay.
 */
export default async function OrderDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const order = await getOrderById(BigInt(id));
  // ban goc: find() tra null -> loi 500 khi doc thuoc tinh; o day tra 404
  if (!order) notFound();
  const [items, provinces] = await Promise.all([getOrderItems(order.id), db.provinces.findMany({ select: { code: true, name: true } })]);
  const seo = __<{ index: { title: string }; detail: { title: string } }>("messages.order");
  const c = parseJson<Cart>(order.cart) ?? {};
  const discount = moneyNumber(parseJson<{ discount?: unknown }>(order.promotion)?.discount);
  const voucher = c.cartVoucher !== undefined && c.cartVoucher !== null ? moneyNumber(c.cartVoucher) : 0;
  const cartTotal = moneyNumber(c.cartTotal);
  const cartLang = cart as Record<string, Record<string, string>>;
  const method = (payment.method as { name: string; title: string }[]).find((m) => m.name === order.method);
  const s = (v: unknown) => (v === null || v === undefined ? "" : String(v));
  const summary: [string, string, boolean?][] = [
    ["Tổng tạm", formatMoney(cartTotal)],
    ["Giảm giá khuyến mại", `- ${formatMoney(discount)}`],
    ["Giảm giá voucher", `- ${formatMoney(voucher)}`],
    ["Vận chuyển", formatMoney(order.shipping)],
  ];

  return (
    <>
      <PageHeader
        title={`Đơn hàng #${order.code}`}
        description={`Tạo lúc ${convertDateTime(order.created_at, "d/m/Y H:i")} · Nguồn: Website`}
        crumbs={[{ label: seo.index.title, href: "/order/index" }, { label: seo.detail.title }]}
      />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid min-w-0 content-start gap-5">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Sản phẩm</CardTitle>
                <CardDescription>{items.length} sản phẩm trong đơn</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4">
              <ul className="divide-y">
                {items.length === 0 && <li className="py-8 text-center text-sm text-muted-foreground">Đơn hàng không có sản phẩm.</li>}
                {items.map((val, i) => (
                  <li key={i} className="flex items-center gap-3 py-3">
                    <span className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={image(val.image)} alt="" className="size-full object-contain" loading="lazy" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="line-clamp-2 text-sm font-medium">{val.name}</div>
                      <div className="text-xs text-muted-foreground">Mã giảm giá: Không có</div>
                    </div>
                    <div className="text-right text-sm whitespace-nowrap tabular-nums">
                      <div className="text-muted-foreground">
                        {formatMoney(val.price)} × {val.qty}
                      </div>
                      <div className="font-medium">{formatMoney(mulMoney(val.price, val.qty))}</div>
                    </div>
                  </li>
                ))}
              </ul>
              <Separator />
              <dl className="ml-auto grid w-full max-w-sm grid-cols-[1fr_auto] gap-x-6 gap-y-1.5 text-sm tabular-nums">
                {summary.map(([label, value]) => (
                  <div key={label} className="contents">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="text-right">{value}</dd>
                  </div>
                ))}
                <dt className="pt-2 font-semibold">Tổng cuối</dt>
                <dd className="pt-2 text-right text-lg font-semibold text-primary">{formatMoney(addMoney(subMoney(cartTotal, discount, voucher), order.shipping))}</dd>
              </dl>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Xử lý đơn hàng</CardTitle>
                <CardDescription>Xác nhận / hủy đơn, cập nhật thanh toán và giao hàng</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <OrderStatusPanel
                id={id}
                confirm={order.confirm}
                payment={order.payment}
                delivery={order.delivery}
                amount={formatMoney(subMoney(cartTotal, discount))}
                methodTitle={method?.title ?? "-"}
                confirmLang={order_.confirm as Record<string, string>}
                cartLang={cartLang}
              />
            </CardContent>
          </Card>
        </div>
        <div className="grid content-start gap-5">
          <OrderNote id={id} defaultValue={s(order.description)} />
          <OrderCustomer
            id={id}
            provinces={provinces}
            info={{
              fullname: s(order.fullname),
              email: s(order.email),
              phone: s(order.phone),
              address: s(order.address),
              province_id: s(order.province_id),
              district_id: s(order.district_id),
              ward_id: s(order.ward_id),
              province_name: s(order.province_name),
              district_name: s(order.district_name),
              ward_name: s(order.ward_name),
            }}
          />
        </div>
      </div>
    </>
  );
}
