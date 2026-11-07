import "server-only";
import { sessionId } from "@/lib/session";

/**
 * Thay session Laravel (SESSION_DRIVER=file) cho gio hang: Cart::instance('shopping'),
 * Cart::instance('pay'), Session 'voucher', session 'orderSummary'.
 * Luu trong bo nho tien trinh theo cookie nc_sid (giong @/lib/flash). Dang nhap /
 * dang xuat khong doi nc_sid nen gio hang giu nguyen nhu session()->regenerate().
 * Het han sau SESSION_LIFETIME=120 phut khong dung.
 */
export type CartOptions = Record<string, unknown>;

/** Gloudemans\Shoppingcart\CartItem (+ thuoc tinh dong remakeCart gan them). */
export type CartItem = {
  rowId: string;
  id: string | number;
  name: string;
  qty: number | string;
  price: number;
  options: CartOptions;
  taxRate: number;
  /** updateFromArray() gan $this->priceTax = price + tax */
  priceTax?: number;
  /** remakeCart() */
  image?: string | null;
  priceOriginal?: number | null;
};

export type ShopSession = {
  shopping: CartItem[];
  pay: CartItem[];
  voucher: Record<string, unknown> | null;
  /** session('orderSummary') — chi giu id don, trang success doc lai tu DB nhu lazy load cua Eloquent */
  orderSummary: { orderIds: bigint[]; totalAmount: number; totalItems: number; buyerId: bigint | null } | null;
  touchedAt: number;
};

const LIFETIME_MS = 120 * 60_000;
const store: Map<string, ShopSession> = ((globalThis as { __ncShop?: Map<string, ShopSession> }).__ncShop ??= new Map());

function sweep(now: number) {
  for (const [k, s] of store) if (now - s.touchedAt > LIFETIME_MS) store.delete(k);
}

export async function shopSession(): Promise<ShopSession> {
  const sid = await sessionId();
  const now = Date.now();
  sweep(now);
  let s = store.get(sid);
  if (!s) {
    s = { shopping: [], pay: [], voucher: null, orderSummary: null, touchedAt: now };
    if (sid !== "anonymous") store.set(sid, s);
  }
  s.touchedAt = now;
  return s;
}
