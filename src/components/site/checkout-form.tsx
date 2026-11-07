"use client";

/* eslint-disable @next/next/no-img-element -- anh qua route /thumb */
import { Loader2, Lock } from "lucide-react";
import { useState } from "react";
import { thumbUrl } from "@/modules/frontend/image";
import { addMoney, formatPrice, subMoney } from "@/modules/frontend/money";

/**
 * Form dat hang kieu Amazon Checkout. Gui POST /cart/create (CartController@store) voi
 * dung ten truong cu: fullname, phone, email, address, description, method.
 * Dia chi My nhap tach dong (address_line1, city, state, zip) roi ghep vao truong
 * `address` truoc khi gui; cac o tach van duoc flash lai (old input) khi loi.
 */
export type CheckoutLine = { rowId: string; name: string; variant: string; image: string | null; qty: number; price: number };

const STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL", "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS",
  "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
  "PR", "GU", "VI", "AS", "MP", "AA", "AE", "AP",
];

export function CheckoutForm({
  lines,
  subtotal,
  discount,
  shipping,
  defaults,
  errors,
  delivery,
  bank,
  shopName,
}: {
  lines: CheckoutLine[];
  subtotal: number;
  discount: number;
  shipping: number;
  defaults: Record<string, string>;
  errors: Record<string, string>;
  delivery: string;
  bank: { name: string; account: string; holder: string };
  /** Ten shop (siteName() o server cha) */
  shopName: string;
}) {
  const [busy, setBusy] = useState(false);
  const [method, setMethod] = useState(defaults.method || "cod");
  const [address, setAddress] = useState(defaults.address ?? "");
  const total = addMoney(subMoney(subtotal, discount), shipping);
  const count = lines.reduce((t, l) => t + l.qty, 0);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    const f = e.currentTarget;
    const get = (n: string) => (f.elements.namedItem(n) as HTMLInputElement | null)?.value.trim() ?? "";
    const line2 = get("address_line2");
    const cityLine = [get("city"), [get("state"), get("zip")].filter(Boolean).join(" ")].filter(Boolean).join(", ");
    const parts = [get("address_line1"), line2, cityLine, "United States"].filter(Boolean);
    // Chi ghep khi co dong dia chi chinh, de handler bao loi "address required" nhu cu
    // Ghi ca DOM lan state: setBusy render lai ngay trong su kien submit, input an phai giu gia tri moi
    const joined = get("address_line1") ? parts.join(", ") : "";
    (f.elements.namedItem("address") as HTMLInputElement).value = joined;
    setAddress(joined);
    setBusy(true);
  };

  const field = (name: string, label: string, opts: { type?: string; auto?: string; required?: boolean; placeholder?: string; half?: boolean; plain?: boolean } = {}) => (
    <div className={opts.half ? "" : "sm:col-span-2"}>
      <label htmlFor={`co-${name}`} className="az-label">
        {label}
        {opts.required === false && !opts.plain ? <span className="font-normal text-az-muted"> (optional)</span> : null}
      </label>
      <input
        id={`co-${name}`}
        name={name}
        type={opts.type ?? "text"}
        defaultValue={defaults[name] ?? ""}
        autoComplete={opts.auto}
        placeholder={opts.placeholder}
        required={opts.required !== false}
        aria-invalid={errors[name] ? true : undefined}
        aria-describedby={errors[name] ? `co-${name}-err` : undefined}
        className="az-input"
      />
      {errors[name] && (
        <p id={`co-${name}-err`} className="mt-1 text-xs text-az-deal">
          {errors[name]}
        </p>
      )}
    </div>
  );

  return (
    <form action="/cart/create" method="post" onSubmit={onSubmit} className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="space-y-4">
        <section className="rounded-lg border border-az-border bg-white p-4 sm:p-5" aria-labelledby="ship-h">
          <h2 id="ship-h" className="mb-3 text-lg font-bold">
            <span className="mr-2">1</span> Shipping address
          </h2>
          <input type="hidden" name="address" value={address} readOnly />
          <div className="grid gap-3 sm:grid-cols-2">
            <p className="text-sm sm:col-span-2">
              Country/Region: <strong>United States</strong>
            </p>
            {field("fullname", "Full name (First and Last name)", { auto: "name" })}
            {field("phone", "Phone number", { type: "tel", auto: "tel", half: true })}
            {field("email", "Email (for order updates)", { type: "email", auto: "email", half: true, required: false })}
            {field("address_line1", "Address", { auto: "address-line1", placeholder: "Street address or P.O. Box" })}
            {field("address_line2", "Apt, suite, unit, building", { auto: "address-line2", required: false })}
            {field("city", "City", { auto: "address-level2", half: true, required: false, plain: true })}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="co-state" className="az-label">
                  State
                </label>
                <select id="co-state" name="state" defaultValue={defaults.state ?? ""} autoComplete="address-level1" className="az-input">
                  <option value="">Select</option>
                  {STATES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="co-zip" className="az-label">
                  ZIP Code
                </label>
                <input id="co-zip" name="zip" defaultValue={defaults.zip ?? ""} autoComplete="postal-code" inputMode="numeric" className="az-input" />
              </div>
            </div>
            {errors.address && <p className="text-xs text-az-deal sm:col-span-2">{errors.address}</p>}
          </div>
        </section>

        <section className="rounded-lg border border-az-border bg-white p-4 sm:p-5" aria-labelledby="pay-h">
          <h2 id="pay-h" className="mb-3 text-lg font-bold">
            <span className="mr-2">2</span> Payment method
          </h2>
          <fieldset className="space-y-2">
            <legend className="sr-only">Payment method</legend>
            {[
              { value: "cod", title: "Pay on delivery", text: "Pay when your order arrives. We'll confirm your order by email or phone first." },
              { value: "bank", title: "Bank transfer", text: "Transfer after placing your order. We process your order once payment is received." },
            ].map((m) => (
              <label
                key={m.value}
                className={`flex cursor-pointer gap-3 rounded-lg border p-3 text-sm ${method === m.value ? "border-az-orange bg-[#fcf5ee]" : "border-az-border"}`}
              >
                <input type="radio" name="method" value={m.value} checked={method === m.value} onChange={() => setMethod(m.value)} className="mt-1 accent-az-link" />
                <span>
                  <span className="block font-bold">{m.title}</span>
                  <span className="text-az-muted">{m.text}</span>
                  {m.value === "bank" && method === "bank" && (
                    <span className="mt-2 block text-xs text-az-text">
                      {bank.account ? (
                        <>
                          Bank: {bank.name} · Account: {bank.account} · Holder: {bank.holder}
                        </>
                      ) : (
                        "Bank details will be emailed to you after you place your order."
                      )}
                    </span>
                  )}
                </span>
              </label>
            ))}
          </fieldset>
        </section>

        <section className="rounded-lg border border-az-border bg-white p-4 sm:p-5" aria-labelledby="items-h">
          <h2 id="items-h" className="mb-1 text-lg font-bold">
            <span className="mr-2">3</span> Review items and shipping
          </h2>
          <p className="mb-3 text-sm font-bold text-az-success">Arriving {delivery}</p>
          <ul className="divide-y divide-az-border">
            {lines.map((l) => (
              <li key={l.rowId} className="flex gap-3 py-3">
                <img src={thumbUrl(l.image, 160)} alt="" className="size-20 shrink-0 object-contain" />
                <div className="text-sm">
                  <p className="font-bold">{l.name}</p>
                  {l.variant && <p className="text-xs text-az-muted">{l.variant}</p>}
                  <p className="mt-1 font-bold text-az-deal">{formatPrice(l.price)}</p>
                  <p className="text-xs">Qty: {l.qty}</p>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-3">
            <label htmlFor="co-description" className="az-label">
              Order note &amp; personalization <span className="font-normal text-az-muted">(optional)</span>
            </label>
            <textarea
              id="co-description"
              name="description"
              rows={3}
              defaultValue={defaults.description ?? ""}
              placeholder="Special requests, delivery instructions, gift message…"
              className="az-input"
            />
          </div>
        </section>
      </div>

      <aside className="h-fit rounded-lg border border-az-border bg-white p-4 lg:sticky lg:top-2" aria-label="Order summary">
        <button type="submit" disabled={busy || !lines.length} className="az-btn az-btn-cart w-full rounded-lg py-2">
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          Place your order
        </button>
        <p className="mt-2 text-center text-xs text-az-muted">
          By placing your order, you agree to {shopName}&apos;s{" "}
          <a href="/privacy-policy" className="az-link">
            privacy notice
          </a>{" "}
          and{" "}
          <a href="/terms" className="az-link">
            conditions of use
          </a>
          .
        </p>
        <hr className="my-3 border-az-border" />
        <h2 className="mb-2 text-lg font-bold">Order Summary</h2>
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between">
            <dt>Items ({count}):</dt>
            <dd>{formatPrice(subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Shipping &amp; handling:</dt>
            <dd>{shipping ? formatPrice(shipping) : "FREE"}</dd>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-az-deal">
              <dt>Promotion applied:</dt>
              <dd>-{formatPrice(discount)}</dd>
            </div>
          )}
        </dl>
        <hr className="my-3 border-az-border" />
        <p className="flex justify-between text-lg font-bold text-az-deal">
          <span>Order total:</span>
          <span>{formatPrice(total)}</span>
        </p>
        <p className="mt-3 flex items-center gap-1 text-xs text-az-muted">
          <Lock className="size-3.5" aria-hidden="true" /> Your information is sent only to {shopName}.
        </p>
      </aside>
    </form>
  );
}
