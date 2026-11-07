"use client";

import { Check, Loader2, Minus, Plus } from "lucide-react";
import { formatPrice } from "@/modules/frontend/money";
import { swatchColor } from "@/modules/frontend/swatch";
import { useBuy, type BuyData, type BuyGroup } from "./buy-state";
import { Price } from "./price";

/**
 * Tung phan cua hop mua hang tach thanh widget rieng cho trinh dung giao dien (gia, bien the, ton kho, so luong,
 * nut them gio, mua ngay, SKU). Moi widget co vai kieu (`design`); chu / mau ke thua tu khoi bao ngoai nen chinh
 * duoc bang muc Chu / Nen cua builder. Cac widget cung san pham dung chung trang thai (buy-state.ts).
 */

export function BuyPrice({ data, design }: { data: BuyData; design?: string }) {
  const b = useBuy(data);
  if (design === "plain") return <span className="tabular-nums">{formatPrice(b.price)}</span>;
  if (design === "sale")
    return (
      <span className="inline-flex items-baseline gap-2">
        <span className="tabular-nums">{formatPrice(b.price)}</span>
        {b.priceRange && !b.variant && (
          <span className="text-[0.6em] opacity-70">
            {formatPrice(b.priceRange[0])} – {formatPrice(b.priceRange[1])}
          </span>
        )}
      </span>
    );
  return (
    <div>
      <Price value={b.price} size={design === "small" ? "md" : "xl"} />
      {design !== "small" && b.priceRange && !b.variant ? (
        <p className="mt-1 text-sm opacity-70">
          Options from {formatPrice(b.priceRange[0])} to {formatPrice(b.priceRange[1])}
        </p>
      ) : null}
    </div>
  );
}

const isSwatch = (g: BuyGroup) => /colou?r/i.test(g.name);

export function BuyOptions({ data, design = "buttons" }: { data: BuyData; design?: string }) {
  const b = useBuy(data);
  if (!data.groups.length) return null;
  return (
    <div className="flex flex-col gap-4">
      {data.groups.map((g) => {
        const cur = g.options.find((o) => o.id === b.selected[g.id]);
        const legend = (
          <legend className="mb-1.5 text-sm">
            {g.name}: <span className="font-bold">{cur?.name ?? "Select"}</span>
          </legend>
        );
        if (design === "dropdown")
          return (
            <label key={g.id} className="flex flex-col gap-1 text-sm">
              <span>{g.name}</span>
              <select
                value={b.selected[g.id] ?? ""}
                onChange={(e) => b.pick(g.id, Number(e.target.value))}
                className="h-10 rounded-lg border border-current/25 bg-white px-3 text-[14px] text-az-text"
              >
                {cur ? null : <option value="">Select {g.name.toLowerCase()}</option>}
                {g.options.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                    {b.possible(g.id, o.id) ? "" : " (unavailable)"}
                  </option>
                ))}
              </select>
            </label>
          );
        return (
          <fieldset key={g.id}>
            {legend}
            <div className={design === "list" ? "flex flex-col gap-1.5" : "flex flex-wrap gap-2"}>
              {g.options.map((o) => {
                const on = b.selected[g.id] === o.id;
                const ok = b.possible(g.id, o.id);
                const swatch = isSwatch(g) && (design === "swatches" || design === "buttons");
                const cls =
                  design === "swatches" && isSwatch(g)
                    ? `size-9 rounded-full border-2 p-0.5 ${on ? "border-az-text" : "border-transparent hover:border-black/30"}`
                    : design === "pills"
                      ? `rounded-full border px-4 py-1.5 text-[13px] ${on ? "border-az-header bg-az-header text-white" : "border-az-border bg-white hover:border-az-link"}`
                      : design === "list"
                        ? `flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-[13px] ${on ? "border-az-link bg-[#edfdff]" : "border-az-border bg-white hover:bg-[#f7fafa]"}`
                        : `min-h-9 rounded-lg border px-3 py-1.5 text-left text-[13px] leading-4 ${on ? "border-az-link bg-[#edfdff] shadow-[0_0_0_1px_#007185]" : "border-[#bbbfbf] bg-white hover:bg-[#f7fafa]"}`;
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => b.pick(g.id, o.id)}
                    aria-pressed={on}
                    title={ok ? o.name : `${o.name} – not available with current selection`}
                    className={`relative text-az-text ${cls} ${ok ? "" : "border-dashed opacity-60"}`}
                  >
                    {design === "swatches" && isSwatch(g) ? (
                      <>
                        <span className="block size-full rounded-full border border-black/15" style={{ background: swatchColor(o.name) }} aria-hidden="true" />
                        <span className="sr-only">{o.name}</span>
                      </>
                    ) : design === "list" ? (
                      <>
                        <span className={`size-4 shrink-0 rounded-full border-2 ${on ? "border-[5px] border-az-link" : "border-az-border"}`} aria-hidden="true" />
                        {isSwatch(g) && <span className="size-4 rounded-full border border-black/20" style={{ background: swatchColor(o.name) }} aria-hidden="true" />}
                        {o.name}
                      </>
                    ) : swatch ? (
                      <span className="flex items-center gap-2">
                        <span className="size-4 rounded-full border border-black/20" style={{ background: swatchColor(o.name) }} aria-hidden="true" />
                        {o.name}
                      </span>
                    ) : (
                      o.name
                    )}
                  </button>
                );
              })}
            </div>
          </fieldset>
        );
      })}
    </div>
  );
}

export function BuyStock({ data, design }: { data: BuyData; design?: string }) {
  const b = useBuy(data);
  const text = b.available ? "In Stock" : b.complete ? "Currently unavailable" : "Select options";
  const color = b.available ? "text-az-success" : "text-az-deal";
  if (design === "badge")
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${b.available ? "bg-[#e7f6ee] text-az-success" : "bg-[#fdecea] text-az-deal"}`}>
        <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
        {text}
      </span>
    );
  return (
    <div>
      <p className={`text-lg ${color}`}>{text}</p>
      {design !== "simple" && b.selectedNames.length > 0 && <p className="mt-1 text-xs opacity-70">{b.selectedNames.join(" / ")}</p>}
    </div>
  );
}

export function BuyQty({ data, design }: { data: BuyData; design?: string }) {
  const b = useBuy(data);
  if (design === "stepper")
    return (
      <div className="inline-flex h-10 items-center rounded-lg border border-az-border bg-white text-az-text">
        <button type="button" aria-label="Decrease quantity" onClick={() => b.setQty(Math.max(1, b.qty - 1))} disabled={b.qty <= 1} className="flex h-full w-10 items-center justify-center disabled:opacity-40">
          <Minus className="size-4" aria-hidden="true" />
        </button>
        <span className="min-w-8 text-center text-sm font-semibold tabular-nums" aria-live="polite">
          {b.qty}
        </span>
        <button type="button" aria-label="Increase quantity" onClick={() => b.setQty(Math.min(b.maxQty, b.qty + 1))} disabled={b.qty >= b.maxQty} className="flex h-full w-10 items-center justify-center disabled:opacity-40">
          <Plus className="size-4" aria-hidden="true" />
        </button>
      </div>
    );
  return (
    <label className="inline-flex items-center gap-1 rounded-lg border border-az-border bg-[#f0f2f2] px-2 py-1 text-[13px] text-az-text shadow-sm">
      Quantity:
      <select value={b.qty} onChange={(e) => b.setQty(Number(e.target.value))} className="bg-transparent outline-none">
        {Array.from({ length: b.maxQty }, (_, i) => i + 1).map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Kieu nut: mau nen / vien theo design; "inherit" = khong mau rieng, dung nen / chu / bo goc cua khoi bao ngoai. */
const BTN: Record<string, string> = {
  yellow: "az-btn az-btn-cart",
  orange: "az-btn az-btn-buy",
  dark: "rounded-full bg-az-text text-white hover:opacity-90",
  outline: "rounded-full border-2 border-current bg-transparent hover:bg-black/5",
  accent: "rounded-full bg-az-cart text-white hover:opacity-90",
  inherit: "bg-transparent [color:inherit] [font:inherit]",
};

export function BuyButton({ data, design, buyNow, label }: { data: BuyData; design?: string; buyNow?: boolean; label?: string }) {
  const b = useBuy(data);
  const cls = BTN[design ?? (buyNow ? "orange" : "yellow")] ?? BTN.yellow;
  const mine = b.action === (buyNow ? "buy" : "cart");
  return (
    <div>
      <button
        type="button"
        onClick={() => b.submit(!!buyNow)}
        disabled={b.status === "busy" || !b.available}
        className={`inline-flex w-full items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${cls}`}
      >
        {b.status === "busy" && mine ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
        {label || (buyNow ? "Buy Now" : "Add to Cart")}
      </button>
      <div role="status" aria-live="polite">
        {mine && b.status === "added" && (
          <div className="mt-3 rounded-lg border border-az-success bg-[#f1faf7] p-3 text-sm text-az-text">
            <p className="flex items-center gap-1 font-bold text-az-success">
              <Check className="size-4" aria-hidden="true" /> Added to cart
            </p>
            <div className="mt-2 flex gap-2">
              <a href="/cart.html" className="az-btn az-btn-secondary px-3 py-1 text-xs">
                Go to Cart
              </a>
              <a href="/checkout.html" className="az-btn az-btn-cart px-3 py-1 text-xs">
                Checkout
              </a>
            </div>
          </div>
        )}
        {mine && b.status === "error" && b.message && <p className="mt-2 text-sm text-az-deal">{b.message}</p>}
      </div>
    </div>
  );
}

export function BuySku({ data }: { data: BuyData }) {
  const b = useBuy(data);
  return b.sku ? <p className="text-xs opacity-70">SKU: {b.sku}</p> : null;
}
