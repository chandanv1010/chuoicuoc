"use client";

import { PlusIcon, Trash2Icon, XIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Field } from "@/components/admin/fields";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Label, NativeSelect } from "@/components/ui/form-controls";
import { Alert } from "@/components/ui/misc";
import { cn } from "@/lib/utils";
import { MoneyInput } from "@/components/admin/money-input";
import { formatMoney, formatMoneyInput, toCents, fromCents } from "@/lib/money";
import { DateTimeInput, getJson, IntInput, ItemThumb, PickedBox, PickerDialog, SearchSuggest, type PaginatorJson, type PickItem } from "./ui";

/**
 * Phan giao dien dong cua form khuyen mai (thay public/vendor/backend/library/promotion.js):
 * chon hinh thuc + 4 khung cau hinh, thoi gian ap dung, nguon khach / doi tuong ap dung.
 * Ten truong gui len giu dung nhu markup jQuery cu (PromotionService/StorePromotionRequest doc).
 */

export type RangeRow = { from: string; to: string; value: string; type: string };
export type ObjectEntry = { id: string; variantId: string; uuid: string; name: string };
export type ProductEntry = { id: string; image: string; name: string; quantity: string };
export type ComboEntry = { id: string; uuid: string; image: string; name: string; quantity: string; price?: number | string | null };

export type PromotionDetailInit = {
  method: string;
  moduleType: string;
  orderRange: RangeRow[];
  pq: { quantity: string; maxDiscountValue: string; discountValue: string; discountType: string };
  object: ObjectEntry[];
  products: ProductEntry[];
  gifts: ProductEntry[];
  combo: { items: ComboEntry[]; price: string };
};

type Labels = Record<string, string>;

/* ------------------------------------------------------------------ */
/* Hinh thuc khuyen mai (detail.blade.php + renderOrderRangeConditionContainer) */
/* ------------------------------------------------------------------ */

export function PromotionDetail({
  init,
  methods,
  itemModels,
  giftModules,
  errors,
}: {
  init: PromotionDetailInit;
  methods: Labels;
  itemModels: Labels;
  giftModules: Labels;
  errors: string[];
}) {
  const [method, setMethod] = useState(init.method && init.method in methods ? init.method : "none");
  return (
    <div className="grid gap-4">
      <Field label="Hình thức khuyến mại" required>
        <NativeSelect name="method" value={method} onChange={(e) => setMethod(e.target.value)} aria-invalid={errors.length > 0 || undefined} className="sm:max-w-sm">
          <option value="none">Chọn hình thức</option>
          {Object.entries(methods).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </NativeSelect>
      </Field>
      {errors.length > 0 && (
        <Alert variant="destructive" className="py-2">
          <ul className="list-disc space-y-0.5 pl-5">
            {errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </Alert>
      )}
      {method === "none" && <p className="rounded-md border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">Chọn hình thức để cài đặt chi tiết khuyến mại.</p>}
      {method === "order_amount_range" && <OrderAmountRange init={init.orderRange} />}
      {method === "product_and_quantity" && <ProductAndQuantity init={init} itemModels={itemModels} />}
      {method === "buy_product_take_gift" && <BuyProductTakeGift init={init} giftModules={giftModules} />}
      {method === "buy_combo" && <BuyCombo init={init.combo} />}
    </div>
  );
}

function DiscountTypeSelect({ name, defaultValue, cash = "cash", percent = "percent" }: { name: string; defaultValue: string; cash?: string; percent?: string }) {
  return (
    <NativeSelect name={name} defaultValue={defaultValue === percent ? percent : cash} className="w-20 shrink-0" aria-label="Loại chiết khấu">
      <option value={cash}>$</option>
      <option value={percent}>%</option>
    </NativeSelect>
  );
}
export { DiscountTypeSelect };

/** Chiet khau theo tong gia tri don hang: bang khoang gia (renderOrderAmountRange + btnJs100). */
function OrderAmountRange({ init }: { init: RangeRow[] }) {
  const [rows, setRows] = useState(() => init.map((r, i) => ({ ...r, uid: i })));
  const [seq, setSeq] = useState(init.length);
  const update = (uid: number, patch: Partial<RangeRow>) => setRows((prev) => prev.map((r) => (r.uid === uid ? { ...r, ...patch } : r)));
  const add = () => {
    const last = rows[rows.length - 1];
    // khoang moi bat dau tu "den" cua khoang truoc + $0.01 (ban VND: +1đ)
    const lastTo = toCents(last?.to ?? "0");
    setRows((prev) => [...prev, { uid: seq, from: formatMoneyInput(fromCents(lastTo + 1)), to: "0.00", value: "0.00", type: "cash" }]);
    setSeq((s) => s + 1);
  };
  return (
    <div className="grid gap-3">
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Giá trị từ ($)</th>
              <th className="px-3 py-2 text-left font-medium">Giá trị đến ($)</th>
              <th className="px-3 py-2 text-left font-medium">Chiết khấu</th>
              <th className="w-12" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">
                  Chưa có khoảng giá trị nào.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.uid} className="border-t">
                <td className="px-3 py-2">
                  <MoneyInput name="promotion_order_amount_range[amountFrom][]" value={r.from} onValueChange={(v) => update(r.uid, { from: v })} />
                </td>
                <td className="px-3 py-2">
                  <MoneyInput name="promotion_order_amount_range[amountTo][]" value={r.to} onValueChange={(v) => update(r.uid, { to: v })} />
                </td>
                <td className="px-3 py-2">
                  <div className="flex gap-2">
                    <MoneyInput hidePrefix wrapperClassName="min-w-0 flex-1" name="promotion_order_amount_range[amountValue][]" value={r.value} onValueChange={(v) => update(r.uid, { value: v })} />
                    <DiscountTypeSelect name="promotion_order_amount_range[amountType][]" defaultValue={r.type} />
                  </div>
                </td>
                <td className="px-2 py-2 text-right">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Xóa điều kiện"
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => setRows((prev) => prev.filter((x) => x.uid !== r.uid))}
                  >
                    <Trash2Icon />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div>
        <Button type="button" variant="outline" size="sm" onClick={add}>
          <PlusIcon /> Thêm điều kiện
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Chiet khau theo tung san pham (renderProductAndQuantity + #findProduct) */
/* ------------------------------------------------------------------ */

type PromoRow = {
  id: number;
  image?: string | null;
  name?: string | null;
  variant_name?: string | null;
  product_variant_id?: number | null;
  uuid?: string | null;
  sku?: string | null;
  price?: number | null;
};

const keyOf = (model: string, e: ObjectEntry) => (model === "ProductCatalogue" ? e.id : `${e.id}_${e.variantId}`);

/** Doi 1 dong ajax/product/loadProductPromotion thanh muc chon. */
function promoRowToItem(model: string, row: PromoRow): PickItem {
  if (model === "ProductCatalogue") {
    // Ban goc: the .search-object-item cua danh muc khong co data-variant_id/uuid -> gui "undefined"
    const entry: ObjectEntry = { id: String(row.id), variantId: "undefined", uuid: "undefined", name: String(row.name ?? "") };
    return { key: entry.id, name: entry.name, raw: { entry } };
  }
  // `${null}` trong template JS cu -> chuoi "null"
  const entry: ObjectEntry = { id: String(row.id), variantId: String(row.product_variant_id ?? null), uuid: String(row.uuid ?? null), name: String(row.variant_name ?? "") };
  return { key: `${entry.id}_${entry.variantId}`, name: entry.name, image: row.image ?? null, sub: `Mã SP: ${row.sku ?? ""}`, price: row.price ?? 0, raw: { entry } };
}

function ProductAndQuantity({ init, itemModels }: { init: PromotionDetailInit; itemModels: Labels }) {
  const firstModel = Object.keys(itemModels)[0] ?? "Product";
  const [model, setModel] = useState(init.moduleType in itemModels ? init.moduleType : firstModel);
  const [objects, setObjects] = useState<ObjectEntry[]>(init.object);
  const [open, setOpen] = useState(false);
  const selected: PickItem[] = objects.map((e) => ({ key: keyOf(model, e), name: e.name, raw: { entry: e } }));

  const load = async (keyword: string, page: number): Promise<PaginatorJson<PickItem>> => {
    const res = await getJson<{ model: string; objects: PaginatorJson<PromoRow> }>("/ajax/product/loadProductPromotion", {
      model,
      keyword: keyword || undefined,
      page: page > 1 ? page : undefined,
    });
    return { ...res.objects, data: res.objects.data.map((r) => promoRowToItem(model, r)) };
  };

  return (
    <div className="grid gap-4">
      <Field label="Sản phẩm áp dụng" className="sm:max-w-sm">
        <NativeSelect
          name="module_type"
          value={model}
          onChange={(e) => {
            // HT.changePromotionMethod: doi loai -> bo cac muc da chon
            setModel(e.target.value);
            setObjects([]);
          }}
        >
          {Object.entries(itemModels).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label={model === "ProductCatalogue" ? "Loại sản phẩm mua" : "Sản phẩm mua"}>
        <PickedBox items={selected} onOpen={() => setOpen(true)} onRemove={(k) => setObjects((prev) => prev.filter((e) => keyOf(model, e) !== k))} />
      </Field>
      {objects.map((e) => (
        <span key={keyOf(model, e)} hidden>
          <input type="hidden" name="object[id][]" value={e.id} />
          <input type="hidden" name="object[product_variant_id][]" value={e.variantId} />
          <input type="hidden" name="object[variant_uuid][]" value={e.uuid} />
          <input type="hidden" name="object[name][]" value={e.name} />
        </span>
      ))}
      <div className="@container">
        <div className="grid gap-4 @lg:grid-cols-3">
          <Field label="Số lượng tối thiểu">
            <IntInput name="product_and_quantity[quantity]" defaultValue={init.pq.quantity} />
          </Field>
          <Field label="Giới hạn KM ($)">
            <MoneyInput name="product_and_quantity[maxDiscountValue]" defaultValue={init.pq.maxDiscountValue} />
          </Field>
          <Field label="Chiết khấu">
            <div className="flex gap-2">
              <MoneyInput hidePrefix wrapperClassName="min-w-0 flex-1" name="product_and_quantity[discountValue]" defaultValue={init.pq.discountValue} />
              <DiscountTypeSelect name="product_and_quantity[discountType]" defaultValue={init.pq.discountType} />
            </div>
          </Field>
        </div>
      </div>
      <PickerDialog
        open={open}
        onOpenChange={setOpen}
        title={model === "ProductCatalogue" ? "Chọn loại sản phẩm" : "Chọn sản phẩm"}
        load={load}
        selected={selected}
        onConfirm={(items) => setObjects(items.map((it) => it.raw.entry as ObjectEntry))}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Mua san pham - tang qua (renderBuyProductTakeGift)                  */
/* ------------------------------------------------------------------ */

type FindProductRow = { id: number; image: string | null; languages?: { pivot?: { name?: string | null } }[] };

async function findProducts(keyword: string): Promise<PickItem[]> {
  const rows = await getJson<FindProductRow[]>("/ajax/dashboard/findProduct", { keyword });
  return rows.map((r) => ({ key: String(r.id), name: String(r.languages?.[0]?.pivot?.name ?? ""), image: r.image, raw: r as unknown as Record<string, unknown> }));
}

function ProductQuantityList<T extends ProductEntry | ComboEntry>({
  prefix,
  items,
  setItems,
  emptyText,
}: {
  prefix: "products" | "product_gifts" | "product_combos";
  items: T[];
  setItems: React.Dispatch<React.SetStateAction<T[]>>;
  emptyText: string;
}) {
  const keyOfItem = (e: ProductEntry | ComboEntry) => ("uuid" in e ? `${e.id}_${e.uuid}` : e.id);
  if (items.length === 0) return <p className="rounded-md border border-dashed px-4 py-4 text-center text-sm text-muted-foreground">{emptyText}</p>;
  return (
    <ul className="divide-y rounded-md border">
      {items.map((e) => {
        const k = keyOfItem(e);
        return (
          <li key={k} className="flex items-center gap-3 px-3 py-2">
            <input type="hidden" name={`${prefix}[id][]`} value={e.id} />
            {"uuid" in e && <input type="hidden" name={`${prefix}[uuid][]`} value={e.uuid} />}
            <input type="hidden" name={`${prefix}[image][]`} value={e.image} />
            <input type="hidden" name={`${prefix}[name][]`} value={e.name} />
            <ItemThumb src={e.image} />
            <div className="min-w-0 flex-1">
              <div className="line-clamp-2 text-sm font-medium">{e.name}</div>
              {"price" in e && e.price !== undefined && e.price !== null && <div className="text-xs text-muted-foreground tabular-nums">{formatMoney(e.price)}</div>}
            </div>
            <IntInput
              name={`${prefix}[quantity][]`}
              value={e.quantity}
              allowEmpty
              placeholder="Số lượng"
              className="w-28"
              aria-label="Số lượng"
              onChange={(v) => setItems((prev) => prev.map((x) => (keyOfItem(x) === k ? { ...x, quantity: v } : x)))}
            />
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Bỏ sản phẩm" onClick={() => setItems((prev) => prev.filter((x) => keyOfItem(x) !== k))}>
              <XIcon />
            </Button>
          </li>
        );
      })}
    </ul>
  );
}

function BuyProductTakeGift({ init, giftModules }: { init: PromotionDetailInit; giftModules: Labels }) {
  const first = Object.keys(giftModules)[0] ?? "";
  const [products, setProducts] = useState<ProductEntry[]>(init.products);
  const [gifts, setGifts] = useState<ProductEntry[]>(init.gifts);
  const toggler = (setList: typeof setProducts) => (item: PickItem) =>
    setList((prev) =>
      prev.some((x) => x.id === item.key)
        ? prev.filter((x) => x.id !== item.key)
        : [...prev, { id: item.key, image: String(item.image ?? ""), name: item.name, quantity: "" }],
    );
  return (
    <div className="grid gap-5">
      <Field label="Áp dụng" className="sm:max-w-sm">
        <NativeSelect name="module_type" defaultValue={init.moduleType in giftModules ? init.moduleType : first}>
          {Object.entries(giftModules).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <div className="grid gap-2">
        <Label>Sản phẩm mua</Label>
        <SearchSuggest placeholder="Chọn sản phẩm mua" search={findProducts} isSelected={(it) => products.some((x) => x.id === it.key)} onToggle={toggler(setProducts)} />
        <ProductQuantityList prefix="products" items={products} setItems={setProducts} emptyText="Chưa chọn sản phẩm mua." />
      </div>
      <div className="grid gap-2">
        <Label>Quà tặng</Label>
        <SearchSuggest placeholder="Chọn quà tặng" search={findProducts} isSelected={(it) => gifts.some((x) => x.id === it.key)} onToggle={toggler(setGifts)} />
        <ProductQuantityList prefix="product_gifts" items={gifts} setItems={setGifts} emptyText="Chưa chọn quà tặng." />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Mua combo (renderBuyCombo + searchCombo)                            */
/* ------------------------------------------------------------------ */

async function searchCombo(keyword: string): Promise<PickItem[]> {
  const res = await getJson<{ objects: PaginatorJson<PromoRow> }>("/ajax/product/loadProductPromotion", { keyword, model: "Product" });
  return res.objects.data.map((r) => {
    const entry: ComboEntry = { id: String(r.id), uuid: String(r.uuid ?? null), image: String(r.image ?? ""), name: String(r.variant_name ?? ""), quantity: "", price: r.price ?? 0 };
    return { key: `${entry.id}_${entry.uuid}`, name: entry.name, image: r.image ?? null, price: r.price ?? 0, raw: { entry } };
  });
}

function BuyCombo({ init }: { init: { items: ComboEntry[]; price: string } }) {
  const [items, setItems] = useState<ComboEntry[]>(init.items);
  const keys = useMemo(() => new Set(items.map((x) => `${x.id}_${x.uuid}`)), [items]);
  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <Label>Sản phẩm mua</Label>
        <SearchSuggest
          placeholder="Chọn sản phẩm mua"
          search={searchCombo}
          isSelected={(it) => keys.has(it.key)}
          onToggle={(it) => setItems((prev) => (keys.has(it.key) ? prev.filter((x) => `${x.id}_${x.uuid}` !== it.key) : [...prev, it.raw.entry as ComboEntry]))}
        />
        <ProductQuantityList prefix="product_combos" items={items} setItems={setItems} emptyText="Chưa chọn sản phẩm cho combo." />
      </div>
      <Field label="Tổng tiền combo ($)" className="sm:max-w-xs">
        <MoneyInput name="product_combos[price]" defaultValue={init.price} placeholder="0.00" />
      </Field>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Thoi gian ap dung (aside.blade.php + HT.promotionNeverEnd)           */
/* ------------------------------------------------------------------ */

export function PromotionSchedule({
  startDate,
  endDate,
  neverEnd: neverEndInit,
  errors,
}: {
  startDate: string;
  endDate: string;
  neverEnd: boolean;
  errors: { startDate?: string; endDate?: string };
}) {
  const [start, setStart] = useState(startDate);
  const [end, setEnd] = useState(neverEndInit ? "" : endDate);
  const [neverEnd, setNeverEnd] = useState(neverEndInit);
  return (
    <div className="grid gap-4">
      <Field label="Ngày bắt đầu" required htmlFor="startDate" error={errors.startDate}>
        <DateTimeInput id="startDate" name="startDate" value={start} onChange={setStart} invalid={Boolean(errors.startDate)} />
      </Field>
      <Field label="Ngày kết thúc" required={!neverEnd} htmlFor="endDate" error={neverEnd ? undefined : errors.endDate}>
        <DateTimeInput id="endDate" name="endDate" value={end} onChange={setEnd} disabled={neverEnd} invalid={!neverEnd && Boolean(errors.endDate)} />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="neverEndDate"
          value="accept"
          checked={neverEnd}
          className="size-4 accent-primary"
          onChange={(e) => {
            const on = e.target.checked;
            setNeverEnd(on);
            // Bo tick: ngay ket thuc lay bang ngay bat dau (giong JS cu)
            setEnd(on ? "" : start);
          }}
        />
        Không có ngày kết thúc
      </label>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Nguon khach + doi tuong ap dung (promotionSource, chooseApplyItem)  */
/* ------------------------------------------------------------------ */

export type AudienceInit = {
  sourceStatus: string;
  sourceValue: string[];
  applyStatus: string;
  applyValue: string[];
  conditions: Record<string, string[]>;
};

function RadioRow({ name, value, checked, onChange, children }: { name: string; value: string; checked: boolean; onChange: () => void; children: React.ReactNode }) {
  return (
    <label className={cn("flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm", checked && "border-primary/50 bg-primary/5")}>
      <input type="radio" name={name} value={value} checked={checked} onChange={onChange} className="size-4 accent-primary" />
      {children}
    </label>
  );
}

export function SourceChooser({ init, sources }: { init: AudienceInit; sources: { id: string; name: string }[] }) {
  const [status, setStatus] = useState(init.sourceStatus === "choose" ? "choose" : "all");
  const [list, setList] = useState(sources);
  // Ban goc goi ajax/source/getAllSource khi chon "Chon nguon khach"
  useEffect(() => {
    if (status !== "choose") return;
    let alive = true;
    getJson<{ data?: { id: number; name: string }[] }>("/ajax/source/getAllSource")
      .then((res) => alive && res.data && setList(res.data.map((s) => ({ id: String(s.id), name: s.name }))))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [status]);
  return (
    <div className="grid gap-2">
      <RadioRow name="source" value="all" checked={status === "all"} onChange={() => setStatus("all")}>
        Áp dụng cho toàn bộ nguồn khách
      </RadioRow>
      <RadioRow name="source" value="choose" checked={status === "choose"} onChange={() => setStatus("choose")}>
        Chọn nguồn khách áp dụng
      </RadioRow>
      {status === "choose" && (
        <Combobox
          name="sourceValue[]"
          multiple
          defaultValue={init.sourceValue}
          options={list.map((s) => ({ value: s.id, label: s.name }))}
          placeholder="Click vào ô để lựa chọn..."
        />
      )}
    </div>
  );
}

export function ApplyChooser({ init, applyList }: { init: AudienceInit; applyList: { id: string; name: string }[] }) {
  const [status, setStatus] = useState(init.applyStatus === "choose" ? "choose" : "all");
  const [values, setValues] = useState<string[]>(init.applyValue);
  return (
    <div className="grid gap-2">
      <RadioRow name="applyStatus" value="all" checked={status === "all"} onChange={() => setStatus("all")}>
        Áp dụng cho toàn bộ đối tượng
      </RadioRow>
      <RadioRow name="applyStatus" value="choose" checked={status === "choose"} onChange={() => setStatus("choose")}>
        Chọn đối tượng khách hàng
      </RadioRow>
      {status === "choose" && (
        <div className="grid gap-3">
          <Combobox
            name="applyValue[]"
            multiple
            value={values}
            onChange={setValues}
            options={applyList.map((a) => ({ value: a.id, label: a.name }))}
            placeholder="Click vào ô để lựa chọn..."
          />
          {values.map((v) => (
            <ConditionItem key={v} value={v} label={applyList.find((a) => a.id === v)?.name ?? v} defaultValue={init.conditions[v] ?? []} />
          ))}
        </div>
      )}
    </div>
  );
}

/** HT.createConditionItem: lay danh sach gia tri qua ajax/dashboard/getPromotionConditionValue. */
function ConditionItem({ value, label, defaultValue }: { value: string; label: string; defaultValue: string[] }) {
  const [options, setOptions] = useState<{ value: string; label: string }[] | null>(null);
  useEffect(() => {
    let alive = true;
    getJson<{ data?: { id: unknown; text: unknown }[]; error?: boolean }>("/ajax/dashboard/getPromotionConditionValue", { value })
      .then((res) => alive && setOptions((res.data ?? []).map((o) => ({ value: String(o.id), label: String(o.text ?? "") }))))
      .catch(() => alive && setOptions([]));
    return () => {
      alive = false;
    };
  }, [value]);
  return (
    <Field label={label}>
      <Combobox name={`${value}[]`} multiple defaultValue={defaultValue} options={options ?? []} placeholder={options ? "Click vào ô để lựa chọn..." : "Đang tải..."} />
    </Field>
  );
}
