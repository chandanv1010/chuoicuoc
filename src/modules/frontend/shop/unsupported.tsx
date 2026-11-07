import { SimplePage } from "@/components/site/simple-page";
import { url } from "@/modules/frontend/helpers";

/**
 * Trang tra ve cua cong thanh toan online (PayPal / VNPay) — nam ngoai pham vi.
 * Hien thong bao + link ve gio hang.
 */
export function UnsupportedPayment({ canonical }: { canonical: string }) {
  const seo = { meta_title: "Payment method not supported", meta_keyword: "", meta_description: "", meta_image: "", canonical: url(canonical) };
  return (
    <SimplePage seo={seo} title="This payment method isn't supported yet">
      <p>
        Online payment is not available at the moment. Please return to your <a href="/cart.html">cart</a> and choose another payment
        method at checkout.
      </p>
    </SimplePage>
  );
}
