import { laravelJson } from "@/modules/product/ajax";
import { ajaxInput, cartError } from "@/modules/frontend/shop/ajax";
import { deleteCartItem } from "@/modules/frontend/shop/cart";
import { shopSession } from "@/modules/frontend/shop/session";

/** POST /ajax/cart/delete — Ajax\CartController@delete (CartService::delete). */
export async function POST(req: Request) {
  const input = await ajaxInput(req);
  const s = await shopSession();
  let response;
  try {
    response = await deleteCartItem(s, input);
  } catch (e) {
    return cartError(req, e);
  }
  return laravelJson({ response, messages: "Removed from cart.", code: !response ? 11 : 10 });
}
