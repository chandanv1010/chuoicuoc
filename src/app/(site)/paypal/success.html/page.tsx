import { UnsupportedPayment } from "@/modules/frontend/shop/unsupported";

/** GET /paypal/success.html — Payment\PaypalController@success: thanh toan PayPal chua ho tro. */
export default function PaypalSuccessPage() {
  return <UnsupportedPayment canonical="paypal/success.html" />;
}
