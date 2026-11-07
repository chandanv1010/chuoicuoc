"use client";

import { Check, Loader2 } from "lucide-react";
import { useState } from "react";
import { addToCart } from "./cart-api";

/** Nut "Add to cart" nho tren the san pham (san pham khong co bien the). */
export function AddToCartButton({ productId, name }: { productId: number; name: string }) {
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const click = async () => {
    setState("busy");
    try {
      await addToCart({ id: productId, quantity: 1 });
      setState("done");
      window.setTimeout(() => setState("idle"), 2500);
    } catch {
      setState("error");
    }
  };
  return (
    <div>
      <button
        type="button"
        onClick={click}
        disabled={state === "busy"}
        className="az-btn az-btn-cart px-3 py-1 text-xs"
        aria-label={`Add ${name} to cart`}
      >
        {state === "busy" ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : null}
        {state === "done" ? <Check className="size-3.5 text-az-success" aria-hidden="true" /> : null}
        {state === "done" ? "Added" : "Add to cart"}
      </button>
      <span role="status" aria-live="polite" className="sr-only">
        {state === "done" ? `${name} added to cart` : state === "error" ? "Could not add to cart" : ""}
      </span>
      {state === "error" && <p className="mt-1 text-xs text-az-deal">Could not add to cart. Please try again.</p>}
    </div>
  );
}
