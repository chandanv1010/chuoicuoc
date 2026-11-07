import { laravelJson } from "@/modules/product/ajax";
import { ajaxInput, cartError } from "@/modules/frontend/shop/ajax";
import { payNow } from "@/modules/frontend/shop/cart";
import { shopSession } from "@/modules/frontend/shop/session";

/** POST /ajax/cart/pay — Ajax\CartController@pay: "Mua ngay" -> Cart::instance('pay'). */
export async function POST(req: Request) {
  const input = await ajaxInput(req);
  const s = await shopSession();
  try {
    const pay = await payNow(s, input.id);
    return laravelJson({ pay, code: 10 });
  } catch (e) {
    // findOrFail ngoai try -> 404
    return cartError(req, e, "uncaught");
  }
}
