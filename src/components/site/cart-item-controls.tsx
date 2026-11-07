"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { removeCartItem, updateCartQty } from "./cart-api";

/**
 * O so luong + "Delete" cua mot dong gio hang (thay nut +/- va .cart-item-remove cua cart.js).
 * Goi POST /ajax/cart/update | /ajax/cart/delete roi lam moi trang de server tinh lai tong.
 */
export function CartItemControls({ rowId, qty, name, disabled = false }: { rowId: string; qty: number; name: string; disabled?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      startTransition(() => router.refresh());
    } catch {
      setError("Couldn't update your cart. Please try again.");
    } finally {
      setBusy(false);
    }
  };
  const max = Math.max(10, qty);
  const loading = busy || pending;

  return (
    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
      <label className="inline-flex items-center gap-1 rounded-lg border border-az-border bg-[#f0f2f2] px-2 py-1 shadow-sm">
        <span>Qty:</span>
        <select
          value={qty}
          disabled={disabled || loading}
          aria-label={`Quantity for ${name}`}
          onChange={(e) => {
            const n = Number(e.target.value);
            run(() => (n === 0 ? removeCartItem(rowId) : updateCartQty(rowId, n)));
          }}
          className="bg-transparent outline-none"
        >
          <option value={0}>0 (Delete)</option>
          {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
      <span className="h-4 border-l border-az-border" aria-hidden="true" />
      <button type="button" disabled={disabled || loading} onClick={() => run(() => removeCartItem(rowId))} className="az-link">
        Delete
      </button>
      <span className="h-4 border-l border-az-border" aria-hidden="true" />
      <a href="/products.html" className="az-link">
        See more like this
      </a>
      {loading && <Loader2 className="size-4 animate-spin text-az-muted" aria-label="Updating cart" />}
      {error && (
        <p role="alert" className="w-full text-az-deal">
          {error}
        </p>
      )}
    </div>
  );
}

