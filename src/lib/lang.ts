import buyer from "@/lang/vn/buyer.json";
import cart from "@/lang/vn/cart.json";
import frontend from "@/lang/vn/frontend.json";
import messages from "@/lang/vn/messages.json";
import module from "@/lang/vn/module.json";
import order from "@/lang/vn/order.json";
import payment from "@/lang/vn/payment.json";
import seller from "@/lang/vn/seller.json";

/**
 * Port cua __('file.key') ben Laravel. Du lieu xuat nguyen van tu
 * waco/resources/lang/vn/*.php (xem docs/laravel/lang-vn-*.json).
 */
const FILES: Record<string, unknown> = { buyer, cart, frontend, messages, module, order, payment, seller };

export function trans<T = string>(key: string, replace: Record<string, string | number> = {}): T {
  let node: unknown = FILES;
  for (const part of key.split(".")) {
    if (node && typeof node === "object" && part in (node as Record<string, unknown>)) {
      node = (node as Record<string, unknown>)[part];
    } else {
      return key as T; // giong Laravel: khong co ban dich thi tra ve chinh key
    }
  }
  if (typeof node === "string") {
    let out = node;
    for (const [k, v] of Object.entries(replace)) out = out.replaceAll(`:${k}`, String(v)).replaceAll(`{${k}}`, String(v));
    return out as T;
  }
  return node as T;
}

/** Alias ngan, doc giong Blade: __('messages.save'). */
export const __ = trans;
