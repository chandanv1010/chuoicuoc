/** GET /paypal/cancel.html — Payment\PaypalController@cancel: ban goc chi `echo '...'; die();`. */
export function GET() {
  return new Response("Payment cancelled.", { headers: { "content-type": "text/html; charset=UTF-8" } });
}
