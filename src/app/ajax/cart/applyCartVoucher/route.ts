import { laravelJson } from "@/modules/product/ajax";
import { ajaxInput, cartError, contentJson } from "@/modules/frontend/shop/ajax";
import { applyCartVoucher } from "@/modules/frontend/shop/cart";
import { shopSession } from "@/modules/frontend/shop/session";

/** GET /ajax/cart/applyCartVoucher — Ajax\CartController@applyCartVoucher (handleApplyCartVoucher). */
export async function GET(req: Request) {
  const input = await ajaxInput(req);
  const s = await shopSession();
  let response;
  try {
    response = await applyCartVoucher(s, input.voucher_id);
  } catch (e) {
    // ngoai try/catch o ban goc: findOrFail -> 404, Exception('Voucher...') -> 500
    return cartError(req, e, "uncaught");
  }
  return laravelJson({ response, carts: contentJson(s.shopping), code: !response ? 11 : 10 });
}
