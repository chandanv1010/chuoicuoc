import { laravelJson } from "@/modules/product/ajax";
import { ajaxInput, cartError } from "@/modules/frontend/shop/ajax";
import { updateCartItem } from "@/modules/frontend/shop/cart";
import { shopSession } from "@/modules/frontend/shop/session";

/** POST /ajax/cart/update — Ajax\CartController@update (CartService::update). */
export async function POST(req: Request) {
  const input = await ajaxInput(req);
  const s = await shopSession();
  let response;
  try {
    response = await updateCartItem(s, input);
  } catch (e) {
    return cartError(req, e);
  }
  return laravelJson({ response, messages: "Quantity updated.", code: !response ? 11 : 10 });
}
