/* eslint-disable @next/next/no-img-element -- anh qua route /thumb */
import { redirect } from "next/navigation";
import { Price } from "@/components/site/price";
import { Alert, SiteFrame } from "@/components/site/site-frame";
import { db } from "@/lib/db";
import { errorBag, oldInput } from "@/lib/flash";
import { writeUrl } from "@/modules/frontend/helpers";
import { thumbUrl } from "@/modules/frontend/image";
import { shopSession } from "@/modules/frontend/shop/session";
import { siteName } from "@/lib/site";

/**
 * GET /quick-checkout.html — CartController@pay: form "yeu cau mua" cho 1 san pham dat qua
 * POST ajax/cart/pay (Cart::instance('pay')); gui POST /cart/createPay (ghi bang contacts).
 * Storefront khong con link toi day ("Buy Now" dung gio hang + /checkout.html),
 * giu route cho tuong thich. Ban goc loi 500 khi gio 'pay' rong -> nay chuyen ve gio hang.
 */
export default async function PayPage() {
  const shop = await siteName();
  const [s, errors, old] = await Promise.all([shopSession(), errorBag(), oldInput()]);
  const last = s.pay[s.pay.length - 1];
  const productId = last ? String(last.id) : null;
  const rows = productId
    ? await db.$queryRaw<{ id: bigint; image: string | null; price: number; name: string | null }[]>`
        SELECT p.id, p.image, p.price,
          (SELECT pl.name FROM product_language pl WHERE pl.product_id = p.id ORDER BY pl.language_id LIMIT 1) AS name
        FROM products p WHERE p.id = ${productId} AND p.deleted_at IS NULL LIMIT 1`
    : [];
  const product = rows[0];
  if (!product) redirect("/cart.html");
  const seo = { meta_title: "Request to buy", meta_keyword: "", meta_description: "", meta_image: "", canonical: writeUrl("quick-checkout", true, true) };
  const v = (k: string) => old<string | null>(k, "") ?? "";

  return (
    <SiteFrame seo={seo}>
      <div className="mx-auto grid max-w-[900px] gap-6 px-4 py-6 md:grid-cols-[260px_minmax(0,1fr)]">
        <div className="rounded-lg border border-az-border p-4">
          <img src={thumbUrl(product.image, 400)} alt="" className="aspect-square w-full object-contain" />
          <h2 className="mt-2 text-sm">{product.name}</h2>
          <Price value={product.price} size="sm" className="mt-1" />
        </div>
        <div>
          <h1 className="az-h1 mb-1">Request to buy</h1>
          <p className="mb-4 text-sm text-az-muted">Leave your details and {shop} will contact you to confirm the order.</p>
          {errors.any() && (
            <div className="mb-3">
              <Alert tone="error">
                <ul className="list-disc pl-5">
                  {errors.all.map((m, i) => (
                    <li key={i}>{m}</li>
                  ))}
                </ul>
              </Alert>
            </div>
          )}
          <form action="/cart/createPay" method="post" className="space-y-3">
            <div>
              <label htmlFor="tp-name" className="az-label">
                Full name
              </label>
              <input id="tp-name" name="fullname" defaultValue={v("fullname")} autoComplete="name" className="az-input" />
            </div>
            <div>
              <label htmlFor="tp-phone" className="az-label">
                Phone number
              </label>
              <input id="tp-phone" name="phone" type="tel" defaultValue={v("phone")} autoComplete="tel" className="az-input" />
            </div>
            <div>
              <label htmlFor="tp-address" className="az-label">
                Shipping address
              </label>
              <input id="tp-address" name="address" defaultValue={v("address")} autoComplete="street-address" className="az-input" />
            </div>
            <input type="hidden" name="method" value="cod" />
            <input type="hidden" name="product_id" value={String(product.id)} />
            <input type="hidden" name="type" value="2" />
            <button type="submit" className="az-btn az-btn-buy rounded-lg">
              Send request
            </button>
          </form>
        </div>
      </div>
    </SiteFrame>
  );
}
