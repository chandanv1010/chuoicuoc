import { UnsupportedPayment } from "@/modules/frontend/shop/unsupported";

/** GET /return/vnpay.html — Payment\VnpayController@vnpay_return: VNPay chua ho tro. */
export default function VnpayReturnPage() {
  return <UnsupportedPayment canonical="return/vnpay.html" />;
}
