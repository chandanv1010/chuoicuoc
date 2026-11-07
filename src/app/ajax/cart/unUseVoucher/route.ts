import { laravelJson } from "@/modules/product/ajax";
import { ajaxInput, cartError, contentJson } from "@/modules/frontend/shop/ajax";
import { unUseVoucher } from "@/modules/frontend/shop/cart";
import { shopSession } from "@/modules/frontend/shop/session";

/** GET /ajax/cart/unUseVoucher — Ajax\CartController@unUseVoucher (handleUnUseVoucher). */
export async function GET(req: Request) {
  const input = await ajaxInput(req);
  const s = await shopSession();
  let response;
  try {
    response = await unUseVoucher(s, input.voucher_id);
  } catch (e) {
    return cartError(req, e, "uncaught");
  }
  return laravelJson({ response, carts: contentJson(s.shopping), code: !response ? 11 : 10 });
}
