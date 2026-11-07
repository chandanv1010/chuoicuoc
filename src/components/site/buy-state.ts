"use client";

import { useMemo, useSyncExternalStore } from "react";
import { addToCart } from "./cart-api";

/**
 * Trang thai mua hang dung chung cho moi widget cua cung mot san pham (chon bien the, gia, ton kho, so luong, nut
 * them gio...). Cac widget nam rai rac trong cay giao dien cua trinh dung nen khong dung context: moi san pham
 * mot store nho (theo productId) tren trinh duyet. Server luon ve trang thai ban dau (bien the con hang dau tien).
 */
export type BuyGroup = { id: number; name: string; options: { id: number; name: string }[] };
export type BuyVariant = { uuid: string; code: string; sku: string | null; price: number; quantity: number };
export type BuyData = { productId: number; basePrice: number; stock: number; sku: string | null; groups: BuyGroup[]; variants: BuyVariant[] };

type State = {
  selected: Record<number, number | null>;
  qty: number;
  status: "idle" | "busy" | "added" | "error";
  message: string;
  /** nut vua bam (de thong bao hien duoi dung nut) */
  action: "cart" | "buy" | null;
};

type Store = { state: State; listeners: Set<() => void> };
const stores = new Map<number, Store>();

const parse = (variants: BuyVariant[]) => variants.map((v) => ({ ...v, ids: v.code.split(",").map((x) => Number(x.trim())) }));

function initialState(d: BuyData): State {
  const parsed = parse(d.variants);
  const first = parsed.find((v) => v.quantity > 0) ?? parsed[0];
  const selected: Record<number, number | null> = {};
  for (const g of d.groups) selected[g.id] = first ? (g.options.find((o) => first.ids.includes(o.id))?.id ?? null) : null;
  return { selected, qty: 1, status: "idle", message: "", action: null };
}

function storeOf(d: BuyData) {
  let s = stores.get(d.productId);
  if (!s) {
    s = { state: initialState(d), listeners: new Set() };
    stores.set(d.productId, s);
  }
  return s;
}

function update(d: BuyData, patch: Partial<State>) {
  const s = storeOf(d);
  s.state = { ...s.state, ...patch };
  s.listeners.forEach((l) => l());
}

export function useBuy(d: BuyData) {
  const server = useMemo(() => initialState(d), [d]);
  const state = useSyncExternalStore(
    (cb) => {
      const s = storeOf(d);
      s.listeners.add(cb);
      return () => s.listeners.delete(cb);
    },
    () => storeOf(d).state,
    () => server,
  );
  const parsed = useMemo(() => parse(d.variants), [d.variants]);
  const { groups } = d;
  const { selected } = state;

  const chosen = groups.map((g) => selected[g.id]).filter((x): x is number => typeof x === "number");
  const complete = groups.length === 0 || chosen.length === groups.length;
  const variant = complete && groups.length ? (parsed.find((v) => chosen.every((id) => v.ids.includes(id)) && v.ids.length === chosen.length) ?? null) : null;
  const price = variant ? variant.price : d.basePrice;
  const available = groups.length ? (variant ? variant.quantity > 0 : complete ? false : true) : d.stock > 0;
  const maxQty = Math.max(1, Math.min(30, groups.length ? (variant?.quantity ?? 30) : d.stock || 30));
  const priceRange = useMemo(() => {
    if (!parsed.length) return null;
    const ps = parsed.map((v) => v.price);
    const lo = Math.min(...ps);
    const hi = Math.max(...ps);
    return lo === hi ? null : ([lo, hi] as [number, number]);
  }, [parsed]);

  /** Lua chon co ton tai bien the khop voi cac nhom khac dang chon khong. */
  const possible = (groupId: number, optionId: number) =>
    parsed.some((v) => v.ids.includes(optionId) && groups.every((g) => g.id === groupId || selected[g.id] == null || v.ids.includes(selected[g.id]!)));

  const pick = (groupId: number, optionId: number) => {
    if (possible(groupId, optionId)) return update(d, { selected: { ...selected, [groupId]: optionId }, status: "idle" });
    // khong khop: nhay toi bien the dau tien co lua chon nay
    const v = parsed.find((x) => x.ids.includes(optionId));
    const next: Record<number, number | null> = {};
    for (const g of groups) next[g.id] = v ? (g.options.find((o) => v.ids.includes(o.id))?.id ?? null) : g.id === groupId ? optionId : null;
    update(d, { selected: next, status: "idle" });
  };

  const submit = async (buyNow: boolean) => {
    const action = buyNow ? "buy" : "cart";
    if (!complete) {
      const missing = groups.find((g) => selected[g.id] == null);
      return update(d, { status: "error", action, message: `Please select ${missing ? missing.name.toLowerCase() : "an option"}.` });
    }
    if (!available) return;
    update(d, { status: "busy", action, message: "" });
    try {
      await addToCart({ id: d.productId, quantity: state.qty, attributeIds: chosen });
      if (buyNow) {
        window.location.href = "/checkout.html";
        return;
      }
      update(d, { status: "added" });
    } catch (e) {
      update(d, { status: "error", message: e instanceof Error ? e.message : "Could not add to cart." });
    }
  };

  return {
    ...state,
    setQty: (qty: number) => update(d, { qty }),
    pick,
    possible,
    submit,
    chosen,
    complete,
    variant,
    price,
    available,
    maxQty,
    priceRange,
    sku: variant?.sku ?? d.sku,
    selectedNames: groups.map((g) => g.options.find((o) => o.id === selected[g.id])?.name).filter(Boolean) as string[],
  };
}
