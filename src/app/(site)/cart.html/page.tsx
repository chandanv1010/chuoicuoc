/* eslint-disable @next/next/no-img-element -- anh qua route /thumb */
import { CartItemControls } from "@/components/site/cart-item-controls";
import { Price } from "@/components/site/price";
import { MiniCard } from "@/components/site/product-card";
import { ProductRow } from "@/components/site/product-row";
import { SiteFrame } from "@/components/site/site-frame";
import { writeUrl } from "@/modules/frontend/helpers";
import { thumbUrl } from "@/modules/frontend/image";
import { formatPrice, subMoney } from "@/modules/frontend/money";
import { cartPromotion, reCaculateCart, remakeCart } from "@/modules/frontend/shop/cart";
import { shopSession } from "@/modules/frontend/shop/session";
import { STORE } from "@/modules/frontend/store";
import { cartLines, getHomeProducts } from "@/modules/frontend/storefront";

/**
 * GET /cart.html — gio hang kieu Amazon ("Shopping Cart" + hop Subtotal).
 * Ban Laravel gop gio + form dat hang tren trang nay (CartController@checkout); ban
 * EMHAUS tach: dat hang o /checkout.html (van POST cart/create). Doi so luong / xoa:
 * POST ajax/cart/update | ajax/cart/delete (CartItemControls).
 */
export default async function CartPage() {
  const s = await shopSession();
  const items = await remakeCart(s.shopping);
  const lines = await cartLines(items);
  const calc = reCaculateCart(s);
  const promo = await cartPromotion(calc.cartTotal);
  const count = lines.reduce((t, l) => t + l.qty, 0);
  const total = subMoney(calc.cartTotal, promo.discount);
  const { bestSellers } = await getHomeProducts();

  const seo = { meta_title: "Shopping Cart", meta_keyword: "", meta_description: "", meta_image: "", canonical: writeUrl("cart") };
  const label = `Subtotal (${count} item${count === 1 ? "" : "s"}):`;

  return (
    <SiteFrame seo={seo} bg="gray">
      <div className="mx-auto grid max-w-[1500px] gap-5 p-3 sm:p-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        {/* Hop subtotal tren mobile */}
        {lines.length > 0 && (
          <div className="bg-white p-4 lg:hidden">
            <p className="text-lg">
              {label} <span className="font-bold">{formatPrice(total)}</span>
            </p>
            <a href="/checkout.html" className="az-btn az-btn-cart mt-3 w-full rounded-lg py-2">
              Proceed to checkout ({count} item{count === 1 ? "" : "s"})
            </a>
          </div>
        )}

        <section className="bg-white px-4 pt-4 pb-2 sm:px-5" aria-labelledby="cart-h">
          <div className="flex items-end justify-between border-b border-az-border pb-2">
            <h1 id="cart-h" className="text-[28px] leading-9">
              {lines.length ? "Shopping Cart" : "Your CustomStitch House Cart is empty"}
            </h1>
            {lines.length > 0 && <span className="hidden text-sm text-az-muted sm:block">Price</span>}
          </div>

          {lines.length === 0 ? (
            <div className="py-6 text-sm">
              <p>Your shopping cart is waiting. Give it purpose — fill it with embroidered hats, napkins and more.</p>
              <a href="/products.html" className="az-link mt-2 inline-block">
                Continue shopping
              </a>
            </div>
          ) : (
            <ul>
              {lines.map((l) => {
                const href = l.canonical ? `/${l.canonical}.html` : "#";
                return (
                  <li key={l.rowId} className="flex gap-3 border-b border-az-border py-4 sm:gap-4">
                    <a href={href} className="flex size-24 shrink-0 items-center justify-center sm:size-[180px]" tabIndex={-1} aria-hidden="true">
                      <img src={thumbUrl(l.image, 360)} alt="" className="max-h-full max-w-full object-contain" loading="lazy" />
                    </a>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <h2 className="text-base leading-5 sm:text-lg sm:leading-6">
                          <a href={href} className="line-clamp-2 hover:text-az-link-hover hover:underline">
                            {l.name}
                          </a>
                        </h2>
                        <Price value={l.price} size="sm" className="shrink-0 font-bold" />
                      </div>
                      <p className="mt-1 text-xs text-az-success">In Stock</p>
                      <p className="text-xs text-az-muted">
                        FREE delivery to {STORE.shipTo} · Ships from {STORE.shipsFrom}
                      </p>
                      {l.variant && (
                        <p className="mt-1 text-xs">
                          <span className="font-bold">Options:</span> {l.variant}
                        </p>
                      )}
                      {l.gift && <p className="mt-1 text-xs font-bold text-az-success">Free gift</p>}
                      <CartItemControls rowId={l.rowId} qty={l.qty} name={l.name} disabled={l.gift} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {lines.length > 0 && (
            <p className="py-3 text-right text-lg">
              {label} <span className="font-bold">{formatPrice(total)}</span>
            </p>
          )}
        </section>

        {lines.length > 0 && (
          <aside className="hidden h-fit space-y-4 lg:block" aria-label="Order subtotal">
            <div className="bg-white p-5">
              <p className="text-sm text-az-success">✓ Your order qualifies for FREE delivery to the United States.</p>
              {promo.discount > 0 && (
                <p className="mt-2 text-sm">
                  Promotion applied: <span className="text-az-deal">-{formatPrice(promo.discount)}</span>
                </p>
              )}
              <p className="mt-3 text-lg">
                {label} <span className="font-bold">{formatPrice(total)}</span>
              </p>
              <a href="/checkout.html" className="az-btn az-btn-cart mt-4 w-full rounded-lg py-2">
                Proceed to checkout
              </a>
            </div>
          </aside>
        )}
      </div>

      <div className="mx-auto max-w-[1500px] px-3 pb-6 sm:px-5">
        <ProductRow title="Customers also shop" href="/products.html">
          {bestSellers.map((p) => (
            <MiniCard key={p.id} product={p} />
          ))}
        </ProductRow>
      </div>
    </SiteFrame>
  );
}
