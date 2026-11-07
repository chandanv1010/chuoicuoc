import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { now } from "@/lib/helpers";
import { addMoney, moneyNumber, moneyString, mulMoney, percentOf, subMoney, sumLines, toCents } from "@/lib/money";
import type { Input } from "@/lib/http";
import { FRONTEND_LANGUAGE } from "@/modules/frontend/core";
import { phpJson, sqlDate } from "@/modules/promotion/php";
import { PromotionEnum } from "@/modules/promotion/promotion";
import { VoucherEnum, findVoucher, type VoucherRow } from "@/modules/voucher/voucher";
import type { Customer } from "./customer";
import { PhpException, isNumeric, ksort, md5, num, phpSerialize } from "./php";
import type { CartItem, CartOptions, ShopSession } from "./session";

/**
 * Port cua:
 *   - goi mindscms/laravelshoppingcart (Cart::instance(...)->add/update/remove/get/count)
 *   - app/Services/V1/Core/CartService.php
 *   - VoucherService::listVoucher + VoucherRepository (phan gio hang dung)
 *   - getPrice()/getVariantPrice() cua MyHelper.php: ban WACO LUON tra gia 0 ("Liên Hệ").
 *     Storefront ban theo gia: dong gio lay products.price / product_variants.price
 *     (basePrice), combo_price (>= 5 cai) van ghi de nhu cu.
 *
 * Bo qua: phi van chuyen ViettelPost (totalShipping luon 0), cong thanh toan online.
 *
 * Tien: USD co xu. CartItem.price la number 2 chu so; moi phep cong/tru/nhan di qua
 * @/lib/money (tinh bang so nguyen xu) de khong troi so thuc (3 x 26.50 = 79.50).
 */

/* ============================== Cart (package) ============================== */

/** config('cart.tax') cua goi (waco khong publish config/cart.php). */
const TAX_RATE = 15;

/** empty() cua PHP */
function phpEmpty(v: unknown) {
  return v === null || v === undefined || v === false || v === 0 || v === "" || v === "0";
}

export class Cart {
  constructor(
    private s: ShopSession,
    private instance: "shopping" | "pay",
  ) {}

  static rowId(id: unknown, options: CartOptions) {
    return md5(String(id) + phpSerialize(ksort(options)));
  }

  content(): CartItem[] {
    return this.s[this.instance];
  }

  /** Cart::add(array) -> CartItem::fromArray + setQuantity + setTaxRate */
  add(data: { id: string | number; name: string; qty: unknown; price: unknown; options?: CartOptions }): CartItem {
    if (phpEmpty(data.qty) || !isNumeric(data.qty)) throw new PhpException("Please supply a valid quantity.");
    const options = data.options ?? {};
    const item: CartItem = {
      rowId: Cart.rowId(data.id, options),
      id: data.id,
      name: data.name,
      qty: data.qty as number | string,
      price: moneyNumber(data.price),
      options,
      taxRate: TAX_RATE,
    };
    const list = this.content();
    const idx = list.findIndex((i) => i.rowId === item.rowId);
    if (idx >= 0) {
      item.qty = num(item.qty) + num(list[idx].qty);
      list[idx] = item;
    } else list.push(item);
    return item;
  }

  get(rowId: unknown): CartItem {
    const item = this.content().find((i) => i.rowId === rowId);
    if (!item) throw new PhpException(`The cart does not contain rowId ${String(rowId ?? "")}.`);
    return item;
  }

  /** Cart::update($rowId, $qty | array) */
  update(rowId: unknown, change: unknown): CartItem | null {
    const item = this.get(rowId);
    const list = this.content();
    if (change && typeof change === "object" && !Array.isArray(change)) {
      const a = change as Partial<CartItem>;
      if ("id" in a) item.id = a.id!;
      if ("qty" in a) item.qty = a.qty!;
      if ("name" in a) item.name = a.name!;
      if ("price" in a) item.price = moneyNumber(a.price);
      item.priceTax = addMoney(item.price, tax(item));
      if ("options" in a) item.options = a.options!;
      item.rowId = Cart.rowId(item.id, item.options);
    } else {
      item.qty = change as number | string;
    }
    const oldIdx = list.findIndex((i) => i.rowId === rowId);
    if (rowId !== item.rowId) {
      list.splice(oldIdx, 1);
      const existing = list.find((i) => i.rowId === item.rowId);
      if (existing) item.qty = num(existing.qty) + num(item.qty);
    }
    if (isNumeric(item.qty) && num(item.qty) <= 0) {
      const i = list.findIndex((x) => x.rowId === item.rowId);
      if (i >= 0) list.splice(i, 1);
      return null;
    }
    const i = list.findIndex((x) => x.rowId === item.rowId);
    if (i >= 0) list[i] = item;
    else list.push(item);
    return item;
  }

  remove(rowId: unknown) {
    const item = this.get(rowId);
    const list = this.content();
    list.splice(list.indexOf(item), 1);
  }

  destroy() {
    this.s[this.instance] = [];
  }

  count(): number {
    return this.content().reduce((t, i) => t + num(i.qty), 0);
  }
}

function tax(item: CartItem): string {
  return moneyString(percentOf(item.price, item.taxRate));
}

function priceTax(item: CartItem): number {
  return item.priceTax ?? addMoney(item.price, tax(item));
}

/** CartItem::toArray() — dang JSON ma JS cu nhan. */
export function cartItemArray(item: CartItem) {
  return {
    rowId: item.rowId,
    id: item.id,
    name: item.name,
    qty: item.qty,
    price: item.price,
    options: item.options,
    tax: tax(item),
    subtotal: moneyString(mulMoney(item.price, num(item.qty))),
  };
}

/** Collection keyBy rowId -> object JSON */
export function cartContentJson(items: CartItem[]) {
  return Object.fromEntries(items.map((i) => [i.rowId, cartItemArray(i)]));
}

const opt = (item: CartItem, key: string) => (item.options[key] ?? null) as Record<string, unknown> | null;

/* ================================ Truy van ================================ */

/** price / combo_price: Prisma.Decimal (DECIMAL(12,2)) */
type ProductLite = { id: bigint; image: string | null; price: unknown; combo_price: unknown; seller_id: bigint | null; publish: number };

async function findProduct(id: unknown): Promise<ProductLite> {
  const rows = isNumeric(id)
    ? await db.$queryRaw<ProductLite[]>`
        SELECT id, image, price, combo_price, seller_id, publish FROM products
        WHERE id = ${String(id)} AND deleted_at IS NULL LIMIT 1`
    : [];
  // findOrFail -> ModelNotFoundException
  if (!rows[0]) throw new PhpException(`No query results for model [App\\Models\\Product] ${String(id ?? "")}`);
  return rows[0];
}

async function productName(id: bigint, language: bigint): Promise<string> {
  const rows = await db.$queryRaw<{ name: string }[]>`
    SELECT name FROM product_language WHERE product_id = ${id} AND language_id = ${language} LIMIT 1`;
  if (!rows[0]) throw new PhpException('Attempt to read property "pivot" on null');
  return rows[0].name;
}

/** PromotionRepository::getPromotionByCartTotal */
type CartPromotionRow = {
  id: bigint;
  name: string;
  code: string;
  discountInformation: string | null;
  startDate: Date;
  endDate: Date | null;
};

async function promotionsByCartTotal(): Promise<CartPromotionRow[]> {
  const today = sqlDate(now()).slice(0, 10);
  return db.$queryRaw<CartPromotionRow[]>`
    SELECT id, name, code, discountInformation, startDate, endDate FROM promotions
    WHERE publish = 2 AND method = ${PromotionEnum.ORDER_AMOUNT_RANGE}
      AND DATE(endDate) >= ${today} AND DATE(startDate) <= ${today} AND deleted_at IS NULL`;
}

/* ============================== CartService ============================== */

export type CartCaculate = {
  cartTotal: number;
  cartTotalItems: number;
  voucher: Record<string, unknown> | null;
  [k: string]: unknown;
};

/** reCaculateCart($voucher = null) */
export function reCaculateCart(s: ShopSession, voucher: Record<string, unknown> | null = null): CartCaculate {
  let totalItems = 0;
  for (const c of s.shopping) totalItems += num(c.qty);
  return {
    cartTotal: sumLines(s.shopping.map((c) => ({ price: c.price, qty: num(c.qty) }))),
    cartTotalItems: totalItems,
    voucher: voucher
      ? {
          id: voucher.id,
          discount: voucher.discount ?? null,
          product_scope: voucher.product_scope,
          min_value: voucher.min_value ?? null,
          combine_promotion: voucher.combine_promotion,
          status_active: true,
        }
      : null,
  };
}

export type CartPromotion = { discount: number; selectedPromotion: CartPromotionRow | null; combine_voucher: boolean };

/** cartPromotion($cartTotal, $voucher) — khuyen mai theo tong tien don (order_amount_range). */
export async function cartPromotion(cartTotal = 0, voucher: Record<string, unknown> | null = null): Promise<CartPromotion> {
  let maxDiscount = 0;
  let selected: CartPromotionRow | null = null;
  let combineVoucher = true;
  const promotions = await promotionsByCartTotal();
  for (const p of promotions) {
    let info: Record<string, unknown> = {};
    try {
      info = (JSON.parse(p.discountInformation ?? "null")?.info ?? {}) as Record<string, unknown>;
    } catch {
      info = {};
    }
    const list = (k: string) => (Array.isArray(info[k]) ? (info[k] as unknown[]) : Object.values((info[k] as object) ?? {}));
    const from = list("amountFrom");
    const to = list("amountTo");
    const value = list("amountValue");
    const type = list("amountType");
    if (from.length && from.length === to.length && to.length === value.length) {
      for (let i = 0; i < from.length; i++) {
        // USD co xu (ban VND: convert_price bo dau cham). So sanh theo xu.
        const total = toCents(cartTotal);
        const f = toCents(from[i]);
        const t = toCents(to[i]);
        if ((total > f && total <= t) || total > t) {
          if (type[i] === "cash") maxDiscount = Math.max(maxDiscount, moneyNumber(value[i]));
          else if (type[i] === "percent") maxDiscount = Math.max(maxDiscount, percentOf(cartTotal, moneyNumber(value[i])));
          selected = p;
        }
      }
    }
  }
  if (promotions.length && voucher && Number(voucher.combine_promotion) !== VoucherEnum.COMBINE_PROMOTION) {
    combineVoucher = false;
  }
  return { discount: maxDiscount, selectedPromotion: selected, combine_voucher: combineVoucher };
}

/** totalDiscountVoucher($carts) */
export function totalDiscountVoucher(items: CartItem[]): number {
  let total = 0;
  for (const v of items) {
    const voucher = opt(v, "voucher");
    if (voucher && voucher.status_combine == true) total = addMoney(total, mulMoney(voucher.discount, num(v.qty)));
  }
  return total;
}

/** remakeCart($carts): gan image + priceOriginal (va status_combine cua voucher) cho tung dong. */
export async function remakeCart(items: CartItem[]): Promise<CartItem[]> {
  if (!items.length) return items;
  const variantIds: string[] = [];
  const productIds: string[] = [];
  for (const c of items) {
    const parts = String(c.id).split("_");
    if (parts.length > 1) variantIds.push(parts[1]);
    else productIds.push(parts[0]);
  }
  const variants = variantIds.length
    ? await db.$queryRaw<{ uuid: string; album: string | null; price: unknown }[]>`
        SELECT uuid, album, price FROM product_variants WHERE uuid IN (${Prisma.join(variantIds)}) AND deleted_at IS NULL`
    : [];
  const products = productIds.length
    ? await db.$queryRaw<{ id: bigint; image: string | null; price: unknown }[]>`
        SELECT id, image, price FROM products WHERE publish = 2 AND id IN (${Prisma.join(productIds)}) AND deleted_at IS NULL`
    : [];
  const vMap = new Map(variants.map((v) => [v.uuid, v]));
  const pMap = new Map(products.map((p) => [String(p.id), p]));
  for (const cart of items) {
    const parts = String(cart.id).split("_");
    const objectId = parts[1] ?? parts[0];
    const voucher = opt(cart, "voucher");
    const variant = vMap.get(objectId);
    const product = pMap.get(objectId);
    if (variant) {
      cart.image = (variant.album ?? "").split(",")[0] ?? null;
      cart.priceOriginal = moneyNumber(variant.price);
    } else if (product) {
      cart.image = product.image;
      cart.priceOriginal = moneyNumber(product.price);
      if (voucher) {
        const onPromotion = num(cart.priceOriginal) > priceTax(cart);
        voucher.status_combine = onPromotion ? Number(voucher.combine_promotion) === VoucherEnum.COMBINE_PROMOTION : true;
        cart.options.voucher = voucher;
      }
    }
  }
  return items;
}

type SellerGroup = { seller_id: bigint | null; items: CartItem[]; total: number };

/** orderSeparate(): tach gio theo products.seller_id (khong co seller -> nhom 'null'). */
async function orderSeparate(s: ShopSession): Promise<Map<string, SellerGroup>> {
  const ids = s.shopping.map((c) => String(c.id)).filter((id) => /^\d+$/.test(id));
  const rows = ids.length
    ? await db.$queryRaw<{ id: bigint; seller_id: bigint | null }[]>`
        SELECT id, seller_id FROM products WHERE id IN (${Prisma.join(ids)}) AND deleted_at IS NULL`
    : [];
  const sellers = new Map(rows.map((r) => [String(r.id), r.seller_id]));
  const groups = new Map<string, SellerGroup>();
  for (const item of s.shopping) {
    const sellerId = sellers.get(String(item.id)) ?? null;
    const key = sellerId ? String(sellerId) : "null";
    const g = groups.get(key) ?? { seller_id: sellerId, items: [], total: 0 };
    g.items.push(item);
    g.total = addMoney(g.total, mulMoney(item.price, num(item.qty)));
    groups.set(key, g);
  }
  return groups;
}

function calculateCartForSeller(items: CartItem[]) {
  let totalItems = 0;
  for (const i of items) totalItems += num(i.qty);
  return { cartTotal: sumLines(items.map((i) => ({ price: i.price, qty: num(i.qty) }))), cartTotalItems: totalItems };
}

export type Shipping = {
  totalShippingCost: number;
  sellerShippingCost: Record<string, { cost: number; weight: number; totalPrice: number }>;
  productsHasCost: { id: string | number }[];
} | null;

/**
 * totalShipping($buyer): ban goc goi API ViettelPost cho tung seller. Van chuyen
 * nam ngoai pham vi -> phi = 0 (san pham WACO hien khong co seller_id nen ban goc
 * cung ra 0). Gio rong -> null nhu ban goc.
 */
export async function totalShipping(s: ShopSession): Promise<Shipping> {
  const groups = await orderSeparate(s);
  if (!groups.size) return null;
  const sellerShippingCost: NonNullable<Shipping>["sellerShippingCost"] = {};
  const productsHasCost: { id: string | number }[] = [];
  for (const [key, g] of groups) {
    if (key === "null") continue;
    for (const item of g.items) productsHasCost.push({ id: item.id });
    sellerShippingCost[key] = { cost: 0, weight: 0, totalPrice: calculateCartForSeller(g.items).cartTotal };
  }
  return { totalShippingCost: 0, sellerShippingCost, productsHasCost };
}

/** cartAndPromotion() */
async function cartAndPromotion(s: ShopSession): Promise<CartCaculate> {
  const shipping = await totalShipping(s);
  const cartVoucher = totalDiscountVoucher(s.shopping);
  const c = reCaculateCart(s);
  const promo = await cartPromotion(c.cartTotal);
  c.cartVoucher = cartVoucher;
  c.ship = shipping ? shipping.totalShippingCost : 0;
  c.cartTotal = addMoney(subMoney(c.cartTotal, promo.discount, cartVoucher), c.ship);
  c.cartDiscount = promo.discount;
  return c;
}

/** Gia thuong cua dong gio: "<productId>_<uuid>" -> product_variants.price, con lai products.price. */
async function basePrice(id: string | number): Promise<number> {
  const [pid, uuid] = String(id).split("_");
  if (uuid) {
    const v = await db.$queryRaw<{ price: unknown }[]>`SELECT price FROM product_variants WHERE uuid = ${uuid} AND deleted_at IS NULL LIMIT 1`;
    if (v[0]) return moneyNumber(v[0].price);
  }
  if (!/^\d+$/.test(pid)) return 0;
  const p = await db.$queryRaw<{ price: unknown }[]>`SELECT price FROM products WHERE id = ${pid} LIMIT 1`;
  return moneyNumber(p[0]?.price);
}

/** applyComboPrice(): >= 5 chai cung san pham va co combo_price -> dung combo_price. */
async function applyComboPrice(s: ShopSession) {
  const cart = new Cart(s, "shopping");
  const groups = new Map<string, { items: CartItem[]; totalQty: number }>();
  for (const item of s.shopping) {
    const pid = String(item.id).split("_")[0];
    const g = groups.get(pid) ?? { items: [], totalQty: 0 };
    g.items.push(item);
    g.totalQty += num(item.qty);
    groups.set(pid, g);
  }
  for (const [pid, g] of groups) {
    const rows = /^\d+$/.test(pid)
      ? await db.$queryRaw<{ combo_price: unknown }[]>`SELECT combo_price FROM products WHERE id = ${pid} AND deleted_at IS NULL LIMIT 1`
      : [];
    if (!rows[0]) continue;
    // Storefront: gia thuong = gia bien the / gia san pham (ban WACO getPrice() luon 0)
    const combo = moneyNumber(rows[0].combo_price);
    if (g.totalQty >= 5 && combo > 0) {
      for (const item of g.items) cart.update(item.rowId, { price: combo });
    } else {
      for (const item of g.items) {
        if (item.options.gifts !== undefined && item.options.gifts !== null) continue; // qua tang giu gia 0
        const normalPrice = await basePrice(item.id);
        if (item.price != normalPrice) cart.update(item.rowId, { price: normalPrice });
      }
    }
  }
}

/* ------------------------------ Khuyen mai qua tang ----------------------------- */

type GiftPromotion = {
  id: bigint;
  discount_information: { info?: { model?: string } } | null;
  products: { id: bigint | null; name: string | null; quantity: number | null }[];
  product_gifts: { id: bigint | null; name: string | null; quantity: number | null }[];
};

/** PromotionService::getProTakeGiftBuyProduct($id) */
async function getProTakeGiftBuyProduct(productId: bigint): Promise<GiftPromotion[]> {
  const rows = await db.$queryRaw<
    {
      id: bigint;
      discountInformation: string | null;
      pd_id: bigint | null;
      pd_name: string | null;
      pd_quantity: number | null;
      pdg_id: bigint | null;
      pdg_name: string | null;
      pdg_quantity: number | null;
    }[]
  >`
    SELECT promotions.id, promotions.discountInformation,
      tb4.product_id AS pd_id, tb4.name AS pd_name, tb2.quantity AS pd_quantity,
      tb7.product_id AS pdg_id, tb7.name AS pdg_name, tb5.quantity AS pdg_quantity
    FROM promotions
    LEFT JOIN promotion_rules tb2 ON tb2.promotion_id = promotions.id
    LEFT JOIN products tb3 ON tb3.id = tb2.product_id
    LEFT JOIN product_language tb4 ON tb4.product_id = tb3.id
    LEFT JOIN promotion_gifts tb5 ON tb5.promotion_id = promotions.id
    LEFT JOIN products tb6 ON tb6.id = tb5.product_id
    LEFT JOIN product_language tb7 ON tb7.product_id = tb6.id
    WHERE promotions.method = ${PromotionEnum.BUY_PRODUCT_TAKE_GIFT}
      AND promotions.id IN (SELECT promotion_id FROM promotion_rules WHERE product_id = ${productId})
      AND promotions.deleted_at IS NULL`;
  const out = new Map<string, GiftPromotion>();
  for (const r of rows) {
    const key = String(r.id);
    let p = out.get(key);
    if (!p) {
      let info = null;
      try {
        info = JSON.parse(r.discountInformation ?? "null");
      } catch {
        info = null;
      }
      p = { id: r.id, discount_information: info, products: [], product_gifts: [] };
      out.set(key, p);
    }
    if (!p.products.some((x) => String(x.id) === String(r.pd_id))) p.products.push({ id: r.pd_id, name: r.pd_name, quantity: r.pd_quantity });
    if (!p.product_gifts.some((x) => String(x.id) === String(r.pdg_id)))
      p.product_gifts.push({ id: r.pdg_id, name: r.pdg_name, quantity: r.pdg_quantity });
  }
  return [...out.values()];
}

type GiftData = { id: number; name: string | null; qty: number; price: 0; gift: "active" };

function giftsForSingleProduct(data: { id: number; qty: unknown; price: number }, carts: CartItem[], promo: GiftPromotion): GiftData[] | null {
  const gifts: GiftData[] = [];
  const target = Number(promo.products[0]?.id);
  const condQty = num(promo.products[0]?.quantity);
  type Row = { id: string | number; quantity: number; gift: boolean; old_quantity: number };
  const rows: Row[] = [];
  if (!carts.length) {
    rows.push({ id: data.id, quantity: num(data.qty), gift: data.id === target, old_quantity: 0 });
  } else {
    for (const v of carts) rows.push({ id: v.id, quantity: num(v.qty), gift: false, old_quantity: num(v.qty) });
    const found = rows.find((r) => r.id == data.id);
    if (found) {
      found.old_quantity = found.quantity;
      found.quantity += num(data.qty);
      found.gift = Number(found.id) === target;
    } else rows.push({ id: data.id, quantity: num(data.qty), gift: data.id === target, old_quantity: 0 });
  }
  for (const r of rows) {
    if (!r.gift) continue;
    const qty = Math.floor(r.quantity / condQty) - Math.floor(r.old_quantity / condQty);
    if (!(qty > 0)) return null;
    for (const g of promo.product_gifts) gifts.push({ id: Number(g.id), name: g.name, qty: num(g.quantity) * qty, price: 0, gift: "active" });
  }
  return gifts;
}

function giftsForMultipleProduct(data: { id: number; qty: unknown; price: number }, carts: CartItem[], promo: GiftPromotion): GiftData[] | null {
  if (!carts.length) return null;
  const rows: { id: string | number; quantity: number }[] = carts.map((i) => ({ id: i.id, quantity: num(i.qty) }));
  // foreach tren ban sao: dong khac san pham dang them -> them mot dong moi (bug ban goc)
  for (const it of [...rows]) if (it.id != data.id) rows.push({ id: data.id, quantity: num(data.qty) });
  let minRatio = Number.MAX_SAFE_INTEGER;
  let found = false;
  for (const cond of promo.products) {
    found = false;
    for (const item of rows) {
      if (item.id == Number(cond.id)) {
        minRatio = Math.min(minRatio, Math.floor(item.quantity / num(cond.quantity)));
        found = true;
        break;
      }
    }
  }
  if (!found) return null;
  return promo.product_gifts.map((g) => ({ id: Number(g.id), name: g.name, qty: num(g.quantity) * minRatio, price: 0, gift: "active" as const }));
}

/* --------------------------------- Voucher --------------------------------- */

/** VoucherRepository::getVoucherForProduct($productId)->first()->discount (customerId = 0) */
async function voucherDiscountForProduct(productId: bigint): Promise<number> {
  const today = sqlDate(now()).slice(0, 10);
  const rows = await db.$queryRaw<{ discount: unknown }[]>`
    SELECT IF(v.max_discount_amount != 0,
        LEAST(CASE WHEN v.discount_type = 'FIXED' THEN v.discount_value
                   WHEN v.discount_type = 'PERCENTAGE' THEN p.price * v.discount_value / 100 ELSE 0 END, v.max_discount_amount),
        CASE WHEN v.discount_type = 'FIXED' THEN v.discount_value
             WHEN v.discount_type = 'PERCENTAGE' THEN p.price * v.discount_value / 100 ELSE 0 END) AS discount
    FROM vouchers v
    LEFT JOIN voucher_products vp ON vp.voucher_id = v.id AND vp.product_id = ${productId}
    LEFT JOIN products p ON p.id = vp.product_id OR (vp.product_id IS NULL AND v.product_scope = 'ALL_PRODUCTS' AND p.id = ${productId})
    WHERE (v.product_scope = 'ALL_PRODUCTS' OR vp.product_id = ${productId})
      AND ((SELECT COUNT(*) FROM voucher_usages WHERE voucher_usages.voucher_id = v.id AND voucher_usages.customer_id = 0) < v.max_usage_per_user)
      AND v.used_quantity < v.total_quantity AND DATE(v.start_date) <= ${today} AND DATE(v.end_date) >= ${today}
      AND v.deleted_at IS NULL`;
  if (!rows[0]) throw new PhpException('Attempt to read property "discount" on null');
  return moneyNumber(rows[0].discount);
}

async function voucherOrFail(id: unknown): Promise<VoucherRow> {
  const v = isNumeric(id) ? await findVoucher(BigInt(Math.trunc(num(id)))) : null;
  if (!v) throw new PhpException(`No query results for model [App\\Models\\Voucher] ${String(id ?? "")}`);
  return v;
}

function voucherJson(v: VoucherRow, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { ...JSON.parse(phpJson(v)), ...extra };
}

/** handleVoucher($voucherId, $productId) — voucher gan vao options cua dong san pham. */
async function handleVoucher(voucherId: unknown, productId: bigint) {
  const voucher = await voucherOrFail(voucherId);
  if (voucher.product_scope === VoucherEnum.ALL_PRODUCTS) {
    await findProduct(productId);
    return voucherJson(voucher, { discount: await voucherDiscountForProduct(productId) });
  }
  if (voucher.product_scope === VoucherEnum.SPECIFIC_PRODUCTS) {
    const ids = await db.$queryRaw<{ product_id: bigint }[]>`SELECT product_id FROM voucher_products WHERE voucher_id = ${voucher.id}`;
    if (ids.some((r) => r.product_id === productId)) return voucherJson(voucher, { discount: await voucherDiscountForProduct(productId) });
    throw new PhpException("This voucher is not valid.");
  }
  throw new PhpException("This voucher is not valid.");
}

/** handleCheckoutVoucherForCart($voucherId): bo voucher khoi moi dong khi chon voucher moi. */
function handleCheckoutVoucherForCart(s: ShopSession, voucherId: unknown) {
  if (voucherId === null || voucherId === undefined) return;
  const cart = new Cart(s, "shopping");
  for (const item of [...s.shopping]) cart.update(item.rowId, { options: { ...item.options, voucher: null } });
}

/** getDiscountVoucherForCart($total, $id) */
async function discountVoucherForCart(total: number, id: bigint) {
  const rows = await db.$queryRaw<{ min_order_value: unknown; discount: unknown }[]>`
    SELECT tb2.min_order_value,
      IF(v.max_discount_amount != 0,
        LEAST(CASE WHEN v.discount_type = 'FIXED' THEN v.discount_value
                   WHEN v.discount_type = 'PERCENTAGE' THEN ${total} * v.discount_value / 100 ELSE 0 END, v.max_discount_amount),
        CASE WHEN v.discount_type = 'FIXED' THEN v.discount_value
             WHEN v.discount_type = 'PERCENTAGE' THEN ${total} * v.discount_value / 100 ELSE 0 END) AS discount
    FROM vouchers v LEFT JOIN voucher_order_conditions tb2 ON tb2.voucher_id = v.id
    WHERE v.id = ${id} AND v.deleted_at IS NULL LIMIT 1`;
  const min = rows[0]?.min_order_value;
  return { min_order_value: min === null || min === undefined ? null : moneyNumber(min), discount: moneyNumber(rows[0]?.discount) };
}

function applyVoucherForItem(s: ShopSession, item: CartItem, voucher: VoucherRow) {
  const raw = voucher.discount_type === "FIXED" ? moneyNumber(voucher.discount_value) : percentOf(item.price, voucher.discount_value);
  const max = moneyNumber(voucher.max_discount_amount);
  // ban goc Math.min(.., 0) khi khong gioi han -> giam 0; dong bo voi SQL: max = 0 la khong gioi han
  const discount = max > 0 ? Math.min(raw, max) : raw;
  new Cart(s, "shopping").update(item.rowId, {
    options: {
      ...item.options,
      voucher: {
        id: Number(voucher.id),
        product_scope: voucher.product_scope,
        discount,
        combine_promotion: voucher.combine_promotion,
        status_combine: true,
      },
    },
  });
}

async function handleCartCaculate(s: ShopSession, voucher: VoucherRow, c: CartCaculate) {
  s.voucher = voucherJson(voucher);
  const carts = await remakeCart(s.shopping);
  const promo = await cartPromotion(c.cartTotal);
  const totalVoucherProduct = totalDiscountVoucher(carts);
  c.cartTotal = subMoney(c.cartTotal, promo.discount, totalVoucherProduct);
  c.voucherDiscount = totalVoucherProduct;
  c.cartDiscount = promo.discount;
  c.voucher = { ...(c.voucher ?? {}), product_scope: voucher.product_scope };
  return c;
}

async function applyVoucherForProducts(s: ShopSession, voucher: VoucherRow, onlyIds: string[] | null) {
  s.voucher = null;
  const c = reCaculateCart(s);
  let combine = true;
  for (const item of [...s.shopping]) {
    if (onlyIds && !onlyIds.includes(String(item.id))) continue;
    if (item.price < num(item.priceOriginal) && Number(voucher.combine_promotion) !== VoucherEnum.COMBINE_PROMOTION) {
      combine = false;
      continue;
    }
    combine = true;
    applyVoucherForItem(s, item, voucher);
  }
  if (!combine) {
    c.combine_voucher = false;
    return c;
  }
  return handleCartCaculate(s, voucher, c);
}

async function applyVoucherForCart(s: ShopSession, voucher: VoucherRow) {
  const vJson = voucherJson(voucher);
  let c = reCaculateCart(s, vJson);
  const promo = await cartPromotion(c.cartTotal, vJson);
  c.cartDiscount = promo.discount;
  if (promo.combine_voucher === false) {
    c.combine_voucher = false;
    return c;
  }
  const shipping = await totalShipping(s);
  c.cartTotal = subMoney(c.cartTotal, promo.discount);
  c.ship = shipping ? shipping.totalShippingCost : 0;
  c.valid = true;
  const ship = c.ship as number;
  const v = (c.voucher ??= {});
  if (voucher.product_scope === VoucherEnum.SHIPPING_ORDERS) {
    if (ship == 0) {
      c.valid = false;
      return c;
    }
    const d = await discountVoucherForCart(ship, voucher.id);
    v.discount = d.discount;
    c.ship = subMoney(ship, d.discount);
    c.cartTotal = addMoney(c.cartTotal, c.ship);
    s.voucher = c.voucher;
  } else {
    const d = await discountVoucherForCart(c.cartTotal, voucher.id);
    if (toCents(subMoney(c.cartTotal, ship)) < toCents(d.min_order_value)) {
      c.valid = false;
      c.min_order_value = d.min_order_value;
      return c;
    }
    v.discount = d.discount;
    c.cartTotal = addMoney(subMoney(c.cartTotal, d.discount), ship);
    s.voucher = c.voucher;
  }
  c = { ...c };
  const cart = new Cart(s, "shopping");
  for (const item of [...s.shopping]) cart.update(item.rowId, { options: { ...item.options, voucher: null } });
  c.combine_voucher = true;
  return c;
}

/** handleApplyCartVoucher($voucherId) — GET ajax/cart/applyCartVoucher */
export async function applyCartVoucher(s: ShopSession, voucherId: unknown) {
  const voucher = await voucherOrFail(voucherId);
  switch (voucher.product_scope) {
    case VoucherEnum.ALL_PRODUCTS:
      return applyVoucherForProducts(s, voucher, null);
    case VoucherEnum.SPECIFIC_PRODUCTS: {
      const ids = (
        await db.$queryRaw<{ id: bigint }[]>`
          SELECT tb3.id FROM vouchers JOIN voucher_products tb2 ON tb2.voucher_id = vouchers.id
          JOIN products tb3 ON tb3.id = tb2.product_id WHERE vouchers.id = ${voucher.id}`
      ).map((r) => String(r.id));
      const hit = s.shopping.map((c) => String(c.id)).filter((id) => ids.includes(id));
      if (!hit.length) throw new PhpException("This voucher does not apply to any item in your cart.");
      return applyVoucherForProducts(s, voucher, hit);
    }
    default:
      return applyVoucherForCart(s, voucher);
  }
}

/** handleUnUseVoucher($voucherId) — GET ajax/cart/unUseVoucher */
export async function unUseVoucher(s: ShopSession, voucherId: unknown) {
  await voucherOrFail(voucherId);
  if (s.voucher) s.voucher = null;
  else handleCheckoutVoucherForCart(s, voucherId);
  const c = reCaculateCart(s);
  const promo = await cartPromotion(c.cartTotal);
  c.cartTotal = subMoney(c.cartTotal, promo.discount);
  return c;
}

/**
 * VoucherService::listVoucher — voucher hien o trang gio hang (chi khi da dang nhap
 * va gio co hang).
 */
export type CartVoucher = {
  id: bigint;
  code: string;
  total_quantity: number;
  product_scope: string;
  discount_type: string;
  discount_value: number;
  max_discount_amount: number | null;
  min_order_value: number | null;
  max_order_value: number | null;
  min_shipping_value: number | null;
  is_active: boolean;
  coupon_use: boolean;
};

export async function listVoucher(cartTotal: number, totalShippingCost: number, carts: CartItem[], customer: Customer): Promise<CartVoucher[]> {
  const today = sqlDate(now()).slice(0, 10);
  const ids = carts.map((c) => String(c.id));
  const orProducts = ids.length
    ? Prisma.sql`OR EXISTS (SELECT 1 FROM voucher_products WHERE voucher_products.voucher_id = vouchers.id AND voucher_products.product_id IN (${Prisma.join(ids)}))`
    : Prisma.empty;
  const rows = await db.$queryRaw<Omit<CartVoucher, "is_active" | "coupon_use">[]>`
    SELECT vouchers.id, ANY_VALUE(vouchers.code) AS code, ANY_VALUE(vouchers.total_quantity) AS total_quantity,
      ANY_VALUE(vouchers.product_scope) AS product_scope, ANY_VALUE(vouchers.discount_type) AS discount_type,
      ANY_VALUE(vouchers.discount_value) AS discount_value, ANY_VALUE(vouchers.max_discount_amount) AS max_discount_amount,
      ANY_VALUE(tb2.min_order_value) AS min_order_value, ANY_VALUE(tb2.max_order_value) AS max_order_value,
      ANY_VALUE(tb3.min_shipping_value) AS min_shipping_value
    FROM vouchers
    LEFT JOIN voucher_order_conditions tb2 ON tb2.voucher_id = vouchers.id
    LEFT JOIN voucher_shipping_conditions tb3 ON tb3.voucher_id = vouchers.id
    WHERE (product_scope = 'TOTAL_ORDERS' OR product_scope = 'SHIPPING_ORDERS' OR product_scope = 'ALL_PRODUCTS' ${orProducts})
      AND ((SELECT COUNT(*) FROM voucher_usages WHERE voucher_usages.voucher_id = vouchers.id AND voucher_usages.customer_id = ${customer.id}) < vouchers.max_usage_per_user)
      AND vouchers.used_quantity < vouchers.total_quantity
      AND DATE(vouchers.start_date) <= ${today} AND DATE(vouchers.end_date) >= ${today}
      AND vouchers.deleted_at IS NULL
    GROUP BY vouchers.id`;
  const active = carts.map((c) => opt(c, "voucher")).filter((v): v is Record<string, unknown> => !!v);
  const money = (x: unknown) => (x === null || x === undefined ? null : moneyNumber(x));
  return rows.map((v) => ({
    ...v,
    discount_value: moneyNumber(v.discount_value),
    max_discount_amount: money(v.max_discount_amount),
    min_order_value: money(v.min_order_value),
    max_order_value: money(v.max_order_value),
    min_shipping_value: money(v.min_shipping_value),
    is_active: active.some((a) => String(a.id) === String(v.id)),
    coupon_use:
      v.min_order_value !== null && v.max_order_value !== null
        ? toCents(cartTotal) >= toCents(v.min_order_value)
        : toCents(totalShippingCost) >= toCents(v.min_shipping_value),
  }));
}

/* ------------------------------ create/update/delete ------------------------------ */

/** CartService::create($request) — POST ajax/cart/create. Loi -> PhpException (ban goc echo + die). */
export async function createCartItem(s: ShopSession, payload: Input): Promise<true> {
  const cart = new Cart(s, "shopping");
  const voucherId = payload.voucher_id ?? null;
  if (s.voucher && voucherId !== null) s.voucher = null;
  handleCheckoutVoucherForCart(s, voucherId);
  const product = await findProduct(payload.id);
  const name = await productName(product.id, FRONTEND_LANGUAGE);
  if (!("quantity" in payload)) throw new PhpException('Undefined array key "quantity"');
  const data: { id: string | number; name: string; qty: unknown; price: number; options?: CartOptions } = {
    id: Number(product.id),
    name,
    qty: payload.quantity,
    price: 0,
  };
  let gifts: GiftData[] | null = null;
  const attributeId = payload.attribute_id;
  const attrs = Array.isArray(attributeId) ? attributeId : attributeId && typeof attributeId === "object" ? Object.values(attributeId) : [];
  if (attributeId !== undefined && attributeId !== null && attrs.length) {
    const code = [...attrs].map((x) => String(x)).sort((a, b) => num(a) - num(b)).join(",");
    const rows = await db.$queryRaw<{ uuid: string; price: unknown; name: string | null }[]>`
      SELECT pv.uuid, pv.price, (SELECT pvl.name FROM product_variant_language pvl WHERE pvl.product_variant_id = pv.id AND pvl.language_id = ${FRONTEND_LANGUAGE} LIMIT 1) AS name
      FROM product_variants pv WHERE pv.code = ${code.trim()} AND pv.product_id = ${product.id} AND pv.deleted_at IS NULL LIMIT 1`;
    const variant = rows[0];
    if (!variant) throw new PhpException('Attempt to read property "uuid" on null');
    data.id = `${product.id}_${variant.uuid}`;
    data.name = `${name} ${variant.name ?? ""}`;
    data.price = moneyNumber(variant.price); // Storefront: gia bien the (ban WACO getVariantPrice() luon 0)
    data.options = { attribute: attributeId };
  } else {
    data.price = moneyNumber(product.price); // Storefront: gia san pham (ban WACO getPrice() luon 0)
    if (payload.type_promotion !== undefined && payload.type_promotion !== null) {
      const promotions = await getProTakeGiftBuyProduct(product.id);
      const promo = promotions.find((p) => p.discount_information?.info?.model == payload.type_promotion);
      if (!promo) throw new PhpException("This promotion is not valid.");
      const d = { id: Number(product.id), qty: payload.quantity, price: 0 };
      const model = promo.discount_information?.info?.model;
      if (model === "single_product") gifts = giftsForSingleProduct(d, s.shopping, promo);
      else if (model === "multiple_product") gifts = giftsForMultipleProduct(d, s.shopping, promo);
    }
    data.options = { voucher: voucherId !== null ? await handleVoucher(voucherId, product.id) : null };
  }
  cart.add(data);
  if (gifts) for (const g of gifts) cart.add({ id: g.id, name: g.name ?? "", qty: g.qty, price: g.price, options: { gifts: "active" } });
  await applyComboPrice(s);
  return true;
}

/** CartService::update($request) — POST ajax/cart/update */
export async function updateCartItem(s: ShopSession, payload: Input) {
  const cart = new Cart(s, "shopping");
  if (!("rowId" in payload)) throw new PhpException('Undefined array key "rowId"');
  if (!("qty" in payload)) throw new PhpException('Undefined array key "qty"');
  cart.update(payload.rowId, payload.qty);
  await applyComboPrice(s);
  const item = cart.get(payload.rowId);
  const c = await cartAndPromotion(s);
  c.cartItemUpdate = cartItemArray(item);
  const voucher = opt(item, "voucher");
  c.cartItemSubTotal = subMoney(mulMoney(item.price, num(item.qty)), voucher?.discount ?? 0);
  return c;
}

/** CartService::delete($request) — POST ajax/cart/delete */
export async function deleteCartItem(s: ShopSession, payload: Input) {
  const cart = new Cart(s, "shopping");
  if (!("rowId" in payload)) throw new PhpException('Undefined array key "rowId"');
  const voucher = s.voucher;
  const removed = cart.get(payload.rowId);
  const rv = opt(removed, "voucher");
  const voucherUnActive = rv ? (rv.id ?? null) : null;
  cart.remove(payload.rowId);
  await applyComboPrice(s);
  const c = await cartAndPromotion(s);
  if (c.cartTotal == 0 && voucher) s.voucher = null;
  c.voucherUnActive = voucherUnActive;
  return c;
}

/* ---------------------------------- Dat hang ---------------------------------- */

/** handleTotalVoucher($carts) */
function handleTotalVoucher(s: ShopSession): number {
  let discount = 0;
  const voucher = s.voucher;
  if (!voucher) {
    for (const item of s.shopping) {
      const v = opt(item, "voucher");
      if (v) discount = addMoney(discount, v.discount);
    }
    return discount;
  }
  if (voucher.product_scope === VoucherEnum.TOTAL_ORDERS || voucher.product_scope === VoucherEnum.SHIPPING_ORDERS) {
    return moneyNumber(voucher.discount);
  }
  for (const item of s.shopping) {
    const v = opt(item, "voucher");
    if (v) discount = addMoney(discount, mulMoney(v.discount, num(item.qty)));
  }
  return discount;
}

/** createOrderVoucher(): tru so luong voucher + ghi voucher_usages / voucher_orders. */
async function createOrderVoucher(tx: Prisma.TransactionClient, s: ShopSession, orderId: bigint, buyer: Customer | null) {
  let voucher = s.voucher;
  if (!voucher) {
    for (const item of s.shopping) {
      const v = opt(item, "voucher");
      if (v) {
        voucher = v;
        break;
      }
    }
  } else s.voucher = null;
  const row = await voucherOrFail(voucher?.id);
  const ts = now();
  await tx.$executeRaw`UPDATE vouchers SET total_quantity = ${row.total_quantity - 1}, used_quantity = 1, updated_at = ${ts} WHERE id = ${row.id}`;
  // $customer->id: khach vang lai -> loi "Attempt to read property id on null" nhu ban goc
  if (!buyer) throw new PhpException('Attempt to read property "id" on null');
  await tx.$executeRaw`INSERT INTO voucher_usages (order_id, voucher_id, customer_id, created_at, updated_at) VALUES (${orderId}, ${row.id}, ${buyer.id}, ${ts}, ${ts})`;
  await tx.$executeRaw`INSERT INTO voucher_orders (order_id, voucher_id, created_at, updated_at) VALUES (${orderId}, ${row.id}, ${ts}, ${ts})`;
}

/**
 * CartService::order($request, $system, $buyer) — POST cart/create.
 * Ghi orders + order_product (+ voucher), luu orderSummary vao session va xoa gio.
 * Ban goc khong gui mail (ham mail() khong duoc goi) va khong tru diem khach.
 */
export async function placeOrder(s: ShopSession, payload: Input, buyer: Customer | null) {
  const groups = await orderSeparate(s);
  const shipping = await totalShipping(s);
  const orderIds: bigint[] = [];
  let totalAmount = 0;
  let totalItems = 0;
  // code = time(): cac don tach seller trong cung giay trung ma nhu ban goc
  const code = String(Math.floor(Date.now() / 1000));
  await db.$transaction(async (tx) => {
    for (const g of groups.values()) {
      const cart = { ...calculateCartForSeller(g.items), cartVoucher: handleTotalVoucher(s) };
      const promo = await cartPromotion(cart.cartTotal);
      const sp = promo.selectedPromotion;
      const promotion = {
        discount: promo.discount,
        name: sp?.name ?? "",
        code: sp?.code ?? "",
        startDate: sp ? sqlDate(sp.startDate) : "",
        endDate: sp?.endDate ? sqlDate(sp.endDate) : "",
      };
      const str = (k: string) => (payload[k] === undefined || payload[k] === null ? null : String(payload[k]));
      const ts = now();
      const ship = g.seller_id ? (shipping?.sellerShippingCost[String(g.seller_id)]?.cost ?? 0) : 0;
      await tx.$executeRaw`
        INSERT INTO orders (code, fullname, phone, email, address, description, promotion, cart, customer_id, method,
          confirm, payment, delivery, shipping, point_used, created_at, updated_at)
        VALUES (${code}, ${str("fullname") ?? ""}, ${str("phone") ?? ""}, ${str("email") ?? ""}, ${str("address") ?? ""},
          ${str("description")}, ${phpJson(promotion)}, ${phpJson(cart)}, ${buyer?.id ?? null}, ${str("method") ?? ""},
          'pending', 'unpaid', 'pending', ${moneyString(ship)}, ${Math.trunc(num(payload.point_redeem ?? 0))}, ${ts}, ${ts})`;
      const [{ id }] = await tx.$queryRaw<{ id: bigint }[]>`SELECT LAST_INSERT_ID() AS id`;
      for (const item of g.items) {
        const [pid, uuid] = String(item.id).split("_");
        await tx.$executeRaw`
          INSERT INTO order_product (order_id, product_id, uuid, name, qty, price, priceOriginal, \`option\`)
          VALUES (${id}, ${pid}, ${uuid ?? null}, ${item.name}, ${Math.trunc(num(item.qty))}, ${moneyString(item.price)},
            ${moneyString(item.priceOriginal)}, ${phpJson(Object.keys(item.options).length ? item.options : [])})`;
      }
      if (cart.cartVoucher !== 0) await createOrderVoucher(tx, s, id, buyer);
      orderIds.push(id);
      totalAmount = addMoney(totalAmount, cart.cartTotal);
      totalItems += cart.cartTotalItems;
    }
  });
  s.orderSummary = { orderIds, totalAmount, totalItems, buyerId: buyer?.id ?? null };
  new Cart(s, "shopping").destroy();
  return s.orderSummary;
}

/* --------------------------------- Mua ngay --------------------------------- */

/** Ajax CartController@pay: dat san pham vao Cart::instance('pay'). */
export async function payNow(s: ShopSession, id: unknown) {
  const product = await findProduct(id);
  const name = await productName(product.id, FRONTEND_LANGUAGE);
  const cart = new Cart(s, "pay");
  cart.destroy();
  // fromArray bo qua 'image'; options rong
  cart.add({ id: Number(product.id), name, qty: 1, price: moneyNumber(product.price) });
  return cartContentJson(cart.content());
}
