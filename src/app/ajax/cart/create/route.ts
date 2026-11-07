import { laravelJson } from "@/modules/product/ajax";
import { ajaxInput, cartError, contentJson } from "@/modules/frontend/shop/ajax";
import { Cart, createCartItem } from "@/modules/frontend/shop/cart";
import { shopSession } from "@/modules/frontend/shop/session";

/** POST /ajax/cart/create — Ajax\CartController@create (CartService::create). */
export async function POST(req: Request) {
  const input = await ajaxInput(req);
  const s = await shopSession();
  let flag: boolean;
  try {
    flag = await createCartItem(s, input);
  } catch (e) {
    return cartError(req, e);
  }
  const cart = new Cart(s, "shopping");
  return laravelJson({
    cart: contentJson(cart.content()),
    cartTotalItems: cart.count(),
    messages: "Added to cart.",
    code: flag ? 10 : 11,
  });
}
