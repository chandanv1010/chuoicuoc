/* eslint-disable @next/next/no-img-element -- anh qua route /thumb */
import { Pager } from "@/components/site/pager";
import { SiteFrame } from "@/components/site/site-frame";
import { url } from "@/modules/frontend/helpers";
import { thumbUrl } from "@/modules/frontend/image";
import { addMoney, formatPrice, subMoney } from "@/modules/frontend/money";
import { resolvePage } from "@/modules/frontend/paginator";
import { requireCustomerPage } from "@/modules/frontend/shop/customer";
import { jsonArray, orderProducts, paginateCustomerOrders } from "@/modules/frontend/shop/orders";
import { usDate } from "@/modules/frontend/store";
import { AccountShell, ORDER_CONFIRM, ORDER_DELIVERY } from "@/modules/frontend/shop/views";

type SP = Promise<Record<string, string | string[] | undefined>>;

/**
 * GET /account/orders.html — CustomerController@historyOrder. Danh sach don
 * kieu Amazon "Your Orders" (the don: ngay dat, tong tien, giao toi, ma don, san pham).
 */
export default async function CustomerOrdersPage({ searchParams }: { searchParams: SP }) {
  const customer = await requireCustomerPage();
  const sp = await searchParams;
  const page = resolvePage(Array.isArray(sp.page) ? sp.page[0] : sp.page);
  const list = await paginateCustomerOrders(customer.id, page);
  const orders = await Promise.all(list.rows.map(async (o) => ({ order: o, items: await orderProducts(o.id) })));
  const seo = { meta_title: "Đơn hàng", meta_keyword: "", meta_description: "", meta_image: "", canonical: url("account/orders.html") };
  const lastPage = Math.max(1, Math.ceil(list.total / list.perPage));

  return (
    <SiteFrame seo={seo}>
      <AccountShell title="Đơn hàng của bạn" crumb="Đơn hàng" wide>
        <p className="mb-4 text-sm">
          đã đặt <strong>{list.total} đơn hàng</strong>
        </p>
        {orders.length === 0 ? (
          <div className="rounded-lg border border-az-border p-6 text-sm">
            <p>Bạn chưa đặt đơn hàng nào.</p>
            <a href="/products.html" className="az-link mt-2 inline-block">
              Bắt đầu mua sắm
            </a>
          </div>
        ) : (
          <ul className="space-y-5">
            {orders.map(({ order, items }) => {
              const cart = jsonArray(order.cart);
              const promotion = jsonArray(order.promotion);
              const total = addMoney(subMoney(cart.cartTotal, promotion.discount, cart.cartVoucher), order.shipping);
              const detail = `/account/orders/${encodeURIComponent(order.code)}.html`;
              const cancelled = order.confirm === "cancle";
              return (
                <li key={String(order.id)} className="overflow-hidden rounded-lg border border-az-border">
                  <div className="flex flex-wrap gap-x-8 gap-y-2 bg-[#f0f2f2] px-4 py-3 text-xs text-az-muted">
                    <div>
                      <p className="uppercase">Ngày đặt</p>
                      <p className="text-sm text-az-text">{usDate(order.created_at)}</p>
                    </div>
                    <div>
                      <p className="uppercase">Tổng tiền</p>
                      <p className="text-sm text-az-text">{formatPrice(total)}</p>
                    </div>
                    <div>
                      <p className="uppercase">Giao đến</p>
                      <p className="text-sm text-az-link">{order.fullname || "-"}</p>
                    </div>
                    <div className="ml-auto text-right">
                      <p className="uppercase">Đơn # {order.code}</p>
                      <a href={detail} className="az-link text-sm">
                        Xem chi tiết đơn
                      </a>
                    </div>
                  </div>
                  <div className="p-4">
                    <p className={`text-lg font-bold ${cancelled ? "text-az-deal" : ""}`}>
                      {cancelled ? "Đã huỷ" : order.delivery === "pending" ? ORDER_CONFIRM[order.confirm] ?? "Đã nhận đơn" : ORDER_DELIVERY(order.delivery)}
                    </p>
                    <p className="mb-3 text-sm text-az-muted">{order.payment === "paid" ? "Đã thanh toán" : "Chờ thanh toán"}</p>
                    <ul className="space-y-3">
                      {items.map((it) => (
                        <li key={String(it.id)} className="flex gap-3">
                          <img src={thumbUrl(it.image, 160)} alt="" className="size-20 shrink-0 object-contain" loading="lazy" />
                          <div className="text-sm">
                            <a href={detail} className="az-link line-clamp-2">
                              {it.name}
                            </a>
                            <p className="text-xs text-az-muted">
                              SL: {it.qty} · {formatPrice(it.price)}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <Pager page={page} lastPage={lastPage} href={(p) => `/account/orders.html${p > 1 ? `?page=${p}` : ""}`} />
      </AccountShell>
    </SiteFrame>
  );
}
