/**
 * GET /return/vnpay_ipn.html — Payment\VnpayController@vnpay_ipn (VNPay goi server-server,
 * tra JSON {RspCode, Message}). VNPay chua ho tro: tra ma 99 nhu nhanh "Unknow error".
 */
export function GET() {
  return Response.json({ RspCode: "99", Message: "This payment method is not supported." });
}
