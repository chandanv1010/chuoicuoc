import { redirect } from "next/navigation";
import { CheckoutForm } from "@/components/site/checkout-form";
import { Alert, SiteFrame } from "@/components/site/site-frame";
import { errorBag, oldInput } from "@/lib/flash";
import { getSystem } from "@/lib/language";
import { siteName } from "@/lib/site";
import { url } from "@/modules/frontend/helpers";
import { cartPromotion, reCaculateCart, remakeCart, totalShipping } from "@/modules/frontend/shop/cart";
import { currentCustomer } from "@/modules/frontend/shop/customer";
import { shopSession } from "@/modules/frontend/shop/session";
import { deliveryWindow } from "@/modules/frontend/store";
import { cartLines } from "@/modules/frontend/storefront";

/**
 * GET /checkout.html — trang thanh toan kieu Amazon (moi, tach tu cart.html cua ban
 * Laravel). Form van POST /cart/create (CartController@store -> placeOrder), loi
 * validate quay lai day (back()) kem old input. Gio rong -> ve gio hang.
 */
export default async function CheckoutPage() {
  const s = await shopSession();
  if (!s.shopping.length) redirect("/cart.html");
  const [system, errors, old, customer, shop] = await Promise.all([getSystem(), errorBag(), oldInput(), currentCustomer(), siteName()]);
  const items = await remakeCart(s.shopping);
  const lines = await cartLines(items);
  const calc = reCaculateCart(s);
  const promo = await cartPromotion(calc.cartTotal);
  const shipping = await totalShipping(s);

  const keys = ["fullname", "phone", "email", "address", "address_line1", "address_line2", "city", "state", "zip", "description", "method"];
  const fallback: Record<string, string> = {
    fullname: customer?.name ?? "",
    phone: customer?.phone ?? "",
    email: customer?.email ?? "",
    address_line1: customer?.address ?? "",
  };
  const defaults = Object.fromEntries(keys.map((k) => [k, String(old<string | null>(k, fallback[k] ?? "") ?? "")]));
  const errs = Object.fromEntries(keys.map((k) => [k, errors.first(k) ?? ""]).filter(([, v]) => v));
  const count = lines.reduce((t, l) => t + l.qty, 0);

  return (
    <SiteFrame seo={{ meta_title: "Checkout", meta_keyword: "", meta_description: "", meta_image: "", canonical: url("checkout.html") }} bg="gray">
      <div className="mx-auto max-w-[1150px] p-3 sm:p-5">
        <h1 className="mb-4 text-[28px] leading-9">
          Checkout{" "}
          <a href="/cart.html" className="az-link text-lg">
            ({count} item{count === 1 ? "" : "s"})
          </a>
        </h1>
        {errors.any() && (
          <div className="mb-4">
            <Alert tone="error" title="There was a problem">
              <ul className="list-disc pl-5">
                {errors.all.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            </Alert>
          </div>
        )}
        <CheckoutForm
          lines={lines.map(({ rowId, name, variant, image, qty, price }) => ({ rowId, name, variant, image, qty, price }))}
          subtotal={calc.cartTotal}
          discount={promo.discount}
          shipping={shipping?.totalShippingCost ?? 0}
          defaults={defaults}
          errors={errs}
          delivery={deliveryWindow()}
          bank={{ name: system.bank_1 ?? "", account: system.bank_2 ?? "", holder: system.bank_3 ?? "" }}
          shopName={shop}
        />
      </div>
    </SiteFrame>
  );
}
