/* eslint-disable @next/next/no-img-element -- anh qua route /thumb */
import { CircleCheck } from "lucide-react";
import { redirect } from "next/navigation";
import { SiteFrame } from "@/components/site/site-frame";
import { flash } from "@/lib/flash";
import { url, writeUrl } from "@/modules/frontend/helpers";
import { thumbUrl } from "@/modules/frontend/image";
import { addMoney, formatPrice, mulMoney, subMoney, sumLines } from "@/modules/frontend/money";
import { jsonArray, ordersByIds } from "@/modules/frontend/shop/orders";
import { num } from "@/modules/frontend/shop/php";
import { shopSession } from "@/modules/frontend/shop/session";
import { deliveryWindow } from "@/modules/frontend/store";
import { PAYMENT_METHOD } from "@/modules/frontend/shop/views";

/**
 * GET /cart/success.html — CartController@success. Doc session orderSummary (khong xoa
 * sau khi xem, giong ban goc). Khong co -> ve trang chu kem flash error.
 */
export default async function CartSuccessPage() {
  const s = await shopSession();
  const summary = s.orderSummary;
  if (!summary) {
    await flash({ error: "Something went wrong while placing your order. Please try again." });
    redirect(url("/"));
  }
  const orders = await ordersByIds(summary.orderIds);
  const seo = { meta_title: "Thank you, your order has been placed", meta_keyword: "", meta_description: "", meta_image: "", canonical: writeUrl("cart/success", true, true) };
  const first = orders[0]?.order;

  return (
    <SiteFrame seo={seo} showFlash={false}>
      <div className="mx-auto grid max-w-[1100px] gap-5 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="rounded-lg border border-az-border p-5">
          <h1 className="flex items-center gap-2 text-xl font-bold text-az-success">
            <CircleCheck className="size-7" aria-hidden="true" /> Order placed, thank you!
          </h1>
          <p className="mt-2 text-sm">
            Confirmation will be sent to {first?.email ? <strong>{first.email}</strong> : "you"}. We&apos;ll review your order and contact you if we need
            personalization details.
          </p>
          <p className="mt-3 text-sm">
            Order number:{" "}
            {orders.map(({ order }, k) => (
              <strong key={String(order.id)}>
                {order.code}
                {k + 1 < orders.length ? ", " : ""}
              </strong>
            ))}
          </p>
          {first && (
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="font-bold">Shipping to</dt>
                <dd>
                  {first.fullname}
                  <br />
                  {first.address}
                </dd>
              </div>
              <div>
                <dt className="font-bold">Estimated delivery</dt>
                <dd>{deliveryWindow()}</dd>
                <dt className="mt-2 font-bold">Payment</dt>
                <dd>{PAYMENT_METHOD(first.method)}</dd>
              </div>
            </dl>
          )}
          <div className="mt-5 flex flex-wrap gap-2">
            <a href="/products.html" className="az-btn az-btn-cart rounded-lg">
              Continue shopping
            </a>
            {summary.buyerId ? (
              <a href="/account/orders.html" className="az-btn az-btn-secondary rounded-lg">
                Review or edit your orders
              </a>
            ) : null}
          </div>
        </section>

        <aside className="space-y-4" aria-label="Order summary">
          {orders.map(({ order, products }) => {
            const cart = jsonArray(order.cart);
            const promotion = jsonArray(order.promotion);
            const discount = addMoney(cart.cartVoucher, promotion.discount);
            const subtotal = sumLines(products);
            return (
              <div key={String(order.id)} className="rounded-lg border border-az-border p-4 text-sm">
                <h2 className="mb-2 font-bold">Order #{order.code}</h2>
                <ul className="space-y-3">
                  {products.map((p) => (
                    <li key={String(p.id)} className="flex gap-3">
                      <img src={thumbUrl(p.image, 120)} alt="" className="size-14 shrink-0 object-contain" />
                      <div>
                        <p className="line-clamp-2">
                          {p.qty} × {p.name}
                        </p>
                        <p className="font-bold">{formatPrice(mulMoney(p.price, p.qty))}</p>
                      </div>
                    </li>
                  ))}
                </ul>
                <dl className="mt-3 space-y-1 border-t border-az-border pt-3">
                  <div className="flex justify-between">
                    <dt>Items:</dt>
                    <dd>{formatPrice(subtotal)}</dd>
                  </div>
                  {discount > 0 && (
                    <div className="flex justify-between text-az-deal">
                      <dt>Discount:</dt>
                      <dd>-{formatPrice(discount)}</dd>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <dt>Shipping:</dt>
                    <dd>{num(order.shipping) ? formatPrice(order.shipping) : "FREE"}</dd>
                  </div>
                  <div className="flex justify-between text-base font-bold">
                    <dt>Order total:</dt>
                    <dd>{formatPrice(addMoney(subMoney(subtotal, discount), order.shipping))}</dd>
                  </div>
                </dl>
              </div>
            );
          })}
        </aside>
      </div>
    </SiteFrame>
  );
}
