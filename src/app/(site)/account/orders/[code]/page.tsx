/* eslint-disable @next/next/no-img-element -- anh qua route /thumb */
import { notFound, redirect } from "next/navigation";
import { SiteFrame } from "@/components/site/site-frame";
import { flash } from "@/lib/flash";
import { url } from "@/modules/frontend/helpers";
import { thumbUrl } from "@/modules/frontend/image";
import { addMoney, formatPrice, moneyNumber, subMoney, sumLines } from "@/modules/frontend/money";
import { requireCustomerPage } from "@/modules/frontend/shop/customer";
import { findCustomerOrder, jsonArray, orderProducts } from "@/modules/frontend/shop/orders";
import { numberFormat } from "@/modules/frontend/shop/php";
import { usDate } from "@/modules/frontend/store";
import { AccountShell, ORDER_CONFIRM, ORDER_DELIVERY, ORDER_PAYMENT, PAYMENT_METHOD } from "@/modules/frontend/shop/views";
import { siteName } from "@/lib/site";

/**
 * GET /account/orders/{code}.html — CustomerController@orderDetail. Khong thay don
 * (hoac don cua nguoi khac) -> ve danh sach don kem flash error (giu nhu ban goc).
 */
export default async function CustomerOrderDetailPage({ params }: { params: Promise<{ code: string }> }) {
  const shop = await siteName();
  const raw = decodeURIComponent((await params).code);
  if (!raw.endsWith(".html") || raw === ".html") notFound();
  const code = raw.slice(0, -".html".length);
  const customer = await requireCustomerPage();
  const order = await findCustomerOrder(code, customer.id);
  if (!order) {
    await flash({ error: "We couldn't find that order in your account." });
    redirect("/account/orders.html");
  }
  const items = await orderProducts(order.id);
  const seo = { meta_title: `Order #${order.code}`, meta_keyword: "", meta_description: "", meta_image: "", canonical: url(`account/orders/${encodeURIComponent(order.code)}.html`) };
  const cart = jsonArray(order.cart);
  const promotion = jsonArray(order.promotion);
  // tinh theo xu (USD): khong troi so thuc
  const itemsTotal = sumLines(items);
  const discount = moneyNumber(promotion.discount);
  const voucher = moneyNumber(cart.cartVoucher);
  const shipping = moneyNumber(order.shipping);
  // cung cong thuc voi admin: tam tinh - khuyen mai - voucher + van chuyen
  const total = addMoney(subMoney(cart.cartTotal ?? itemsTotal, discount, voucher), shipping);
  const steps = ["Ordered", "Shipped", "Delivered"];
  const step = order.delivery === "success" ? 2 : order.delivery === "processing" ? 1 : 0;
  const cancelled = order.confirm === "cancle";

  return (
    <SiteFrame seo={seo}>
      <AccountShell title="Order Details" crumb="Your Orders" wide>
        <p className="mb-4 text-sm">
          Ordered on {usDate(order.created_at)} <span className="mx-2 text-az-border">|</span> Order# {order.code}
        </p>

        <div className="grid gap-5 rounded-lg border border-az-border p-5 text-sm sm:grid-cols-3">
          <div>
            <h2 className="mb-1 font-bold">Shipping Address</h2>
            <p>{order.fullname}</p>
            <p className="whitespace-pre-line">{order.address}</p>
            <p>{order.phone}</p>
            {order.email ? <p>{order.email}</p> : null}
          </div>
          <div>
            <h2 className="mb-1 font-bold">Payment Method</h2>
            <p>{PAYMENT_METHOD(order.method)}</p>
            <p className="text-az-muted">{ORDER_PAYMENT(order.payment)}</p>
            {order.description ? (
              <>
                <h2 className="mt-3 mb-1 font-bold">Order note</h2>
                <p className="whitespace-pre-line">{order.description}</p>
              </>
            ) : null}
          </div>
          <div>
            <h2 className="mb-1 font-bold">Order Summary</h2>
            <dl className="space-y-0.5">
              <div className="flex justify-between">
                <dt>Item(s) Subtotal:</dt>
                <dd>{formatPrice(itemsTotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Shipping &amp; Handling:</dt>
                <dd>{shipping ? formatPrice(shipping) : "FREE"}</dd>
              </div>
              {discount > 0 && (
                <div className="flex justify-between">
                  <dt>Promotion:</dt>
                  <dd>-{formatPrice(discount)}</dd>
                </div>
              )}
              {voucher > 0 && (
                <div className="flex justify-between">
                  <dt>Voucher:</dt>
                  <dd>-{formatPrice(voucher)}</dd>
                </div>
              )}
              {order.point_used > 0 && (
                <div className="flex justify-between">
                  <dt>Points used:</dt>
                  <dd>{numberFormat(order.point_used)}</dd>
                </div>
              )}
              <div className="flex justify-between pt-1 font-bold">
                <dt>Grand Total:</dt>
                <dd>{formatPrice(total)}</dd>
              </div>
            </dl>
          </div>
        </div>

        <section className="mt-5 rounded-lg border border-az-border p-5" aria-labelledby="status-h">
          <h2 id="status-h" className={`text-lg font-bold ${cancelled ? "text-az-deal" : ""}`}>
            {cancelled ? "Cancelled" : ORDER_DELIVERY(order.delivery)}
          </h2>
          <p className="text-sm text-az-muted">Order status: {ORDER_CONFIRM[order.confirm] ?? order.confirm}</p>
          {!cancelled && (
            <ol className="my-4 flex items-center text-xs" aria-label="Shipment progress">
              {steps.map((s, i) => (
                <li key={s} className="flex flex-1 items-center gap-2 last:flex-none">
                  <span className={`flex size-6 shrink-0 items-center justify-center rounded-full ${i <= step ? "bg-az-success text-white" : "bg-[#ddd]"}`} aria-hidden="true">
                    {i + 1}
                  </span>
                  <span className={i <= step ? "font-bold" : "text-az-muted"}>
                    {s}
                    {i <= step ? <span className="sr-only"> (completed)</span> : null}
                  </span>
                  {i < steps.length - 1 && <span className={`mx-2 h-1 flex-1 rounded ${i < step ? "bg-az-success" : "bg-[#ddd]"}`} aria-hidden="true" />}
                </li>
              ))}
            </ol>
          )}
          <ul className="mt-3 space-y-4">
            {items.map((it) => (
              <li key={String(it.id)} className="flex gap-4">
                <img src={thumbUrl(it.image, 200)} alt="" className="size-24 shrink-0 object-contain" loading="lazy" />
                <div className="text-sm">
                  <p className="text-az-link">{it.name}</p>
                  <p className="mt-1 text-xs text-az-muted">Sold by: {shop}</p>
                  <p className="mt-1 font-bold text-az-deal">{formatPrice(it.price)}</p>
                  <p className="text-xs">Qty: {it.qty}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
        <p className="mt-4 text-sm">
          Need help with this order?{" "}
          <a href="/contact.html" className="az-link">
            Contact {shop}
          </a>
        </p>
      </AccountShell>
    </SiteFrame>
  );
}
