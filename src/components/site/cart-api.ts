/**
 * Goi cac endpoint gio hang cu (thay cart.js + jQuery $.ajax cua ban Laravel):
 *   POST /ajax/cart/create {id, quantity, attribute_id[]}
 *   POST /ajax/cart/update {rowId, qty}
 *   POST /ajax/cart/delete {rowId}
 * Endpoint tra JSON khi thanh cong; loi CartService tra text (echo + die) -> nem Error.
 * Sau khi doi gio, phat su kien CART_EVENT de header cap nhat so luong.
 */
export const CART_EVENT = "site:cart";

async function post(url: string, body: URLSearchParams): Promise<Record<string, unknown>> {
  const res = await fetch(url, {
    method: "POST",
    body,
    headers: { "x-requested-with": "XMLHttpRequest", accept: "application/json" },
    credentials: "same-origin",
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  if (!res.ok || !json || typeof json !== "object") throw new Error("Something went wrong. Please try again.");
  return json as Record<string, unknown>;
}

export async function addToCart(input: { id: number | string; quantity: number; attributeIds?: number[] }) {
  const body = new URLSearchParams({ id: String(input.id), quantity: String(input.quantity) });
  for (const a of input.attributeIds ?? []) body.append("attribute_id[]", String(a));
  const json = await post("/ajax/cart/create", body);
  const count = Number(json.cartTotalItems ?? 0);
  window.dispatchEvent(new CustomEvent(CART_EVENT, { detail: { count } }));
  return { count };
}

export async function updateCartQty(rowId: string, qty: number) {
  return post("/ajax/cart/update", new URLSearchParams({ rowId, qty: String(qty) }));
}

export async function removeCartItem(rowId: string) {
  return post("/ajax/cart/delete", new URLSearchParams({ rowId }));
}
