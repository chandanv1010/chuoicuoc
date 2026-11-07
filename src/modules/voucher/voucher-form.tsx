"use client";

import { useState } from "react";
import { Field } from "@/components/admin/fields";
import { MoneyInput } from "@/components/admin/money-input";
import { NativeSelect } from "@/components/ui/form-controls";
import { DiscountTypeSelect } from "@/modules/promotion/promotion-form";
import { DateTimeInput, getJson, PickedBox, PickerDialog, type PaginatorJson, type PickItem } from "@/modules/promotion/ui";

/**
 * Phan giao dien dong cua form voucher (thay public/vendor/backend/library/voucher.js):
 * chon hinh thuc (tong don / phi van chuyen / san pham), dieu kien rieng tung loai,
 * chon san pham qua ajax/product/loadProductVoucher. Ten truong giu nhu markup jQuery cu.
 */

export type VoucherValues = {
  min: string;
  max: string;
  max_discount_amount: string;
  discount_value: string;
  discount_type: string;
};

export type VoucherDetailInit = {
  method: string;
  productScope: string;
  totalOrder: VoucherValues | null;
  shipping: VoucherValues | null;
  product: Omit<VoucherValues, "min" | "max"> | null;
  object: { id: string; name: string }[];
};

const DEFAULTS: VoucherValues = { min: "0.00", max: "0.00", max_discount_amount: "0.00", discount_value: "0.00", discount_type: "FIXED" };

export function VoucherDetail({
  init,
  methods,
  scopes,
  error,
}: {
  init: VoucherDetailInit;
  methods: Record<string, string>;
  scopes: Record<string, string>;
  error?: string;
}) {
  const [method, setMethod] = useState(init.method in methods ? init.method : "none");
  return (
    <div className="grid gap-4">
      <Field label="Hình thức áp dụng voucher" required error={error}>
        <NativeSelect name="method" value={method} onChange={(e) => setMethod(e.target.value)} className="sm:max-w-sm">
          <option value="none">Chọn hình thức</option>
          {Object.entries(methods).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </NativeSelect>
      </Field>
      {method === "none" && <p className="rounded-md border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">Chọn hình thức để cài đặt chi tiết voucher.</p>}
      {method === "TOTAL_ORDERS" && <RangeVoucher prefix="TOTAL_ORDERS" kind="order" init={init.totalOrder ?? DEFAULTS} label="Giá trị đơn hàng" />}
      {method === "SHIPPING_ORDERS" && <RangeVoucher prefix="SHIPPING_ORDERS" kind="shipping" init={init.shipping ?? DEFAULTS} label="Phí vận chuyển" />}
      {method === "PRODUCT_VOUCHER" && <ProductVoucher init={init} scopes={scopes} />}
    </div>
  );
}

function Discount({ prefix, init }: { prefix: string; init: Omit<VoucherValues, "min" | "max"> }) {
  return (
    <>
      <Field label="Giảm tối đa ($)">
        <MoneyInput name={`${prefix}[max_discount_amount]`} defaultValue={init.max_discount_amount} />
      </Field>
      <Field label="Chiết khấu">
        <div className="flex gap-2">
          <MoneyInput hidePrefix wrapperClassName="min-w-0 flex-1" name={`${prefix}[discount_value]`} defaultValue={init.discount_value} />
          <DiscountTypeSelect name={`${prefix}[discount_type]`} defaultValue={init.discount_type} cash="FIXED" percent="PERCENTAGE" />
        </div>
      </Field>
    </>
  );
}

/** renderVoucherTotalOrder / renderVoucherTotalShip */
function RangeVoucher({ prefix, kind, init, label }: { prefix: string; kind: "order" | "shipping"; init: VoucherValues; label: string }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label={`${label} từ ($)`}>
        <MoneyInput name={`${prefix}[min_${kind}_value]`} defaultValue={init.min} />
      </Field>
      <Field label={`${label} đến ($)`}>
        <MoneyInput name={`${prefix}[max_${kind}_value]`} defaultValue={init.max} />
      </Field>
      <Discount prefix={prefix} init={init} />
    </div>
  );
}

type VoucherRow = { id: number; code: string | null; price: number | null; image: string | null; name: string | null };

async function loadProducts(keyword: string, page: number): Promise<PaginatorJson<PickItem>> {
  // Ban goc gui model = gia tri select (SPECIFIC_PRODUCTS) khi tim kiem/phan trang -> loi 500; luon gui Product
  const res = await getJson<{ objects: PaginatorJson<VoucherRow> }>("/ajax/product/loadProductVoucher", {
    model: "Product",
    keyword: keyword || undefined,
    page: page > 1 ? page : undefined,
  });
  return {
    ...res.objects,
    data: res.objects.data.map((r) => ({ key: String(r.id), name: String(r.name ?? ""), image: r.image, sub: `Mã SP: ${r.code ?? ""}`, price: r.price ?? 0, raw: r })),
  };
}

/** renderProductAndQuantity cua voucher.js (+ disableSelect: Toan bo san pham thi khoa o chon) */
function ProductVoucher({ init, scopes }: { init: VoucherDetailInit; scopes: Record<string, string> }) {
  const first = Object.keys(scopes)[0] ?? "SPECIFIC_PRODUCTS";
  const [scope, setScope] = useState(init.productScope in scopes ? init.productScope : first);
  const [objects, setObjects] = useState(init.object);
  const [open, setOpen] = useState(false);
  const all = scope === "ALL_PRODUCTS";
  const selected: PickItem[] = objects.map((o) => ({ key: o.id, name: o.name, raw: o }));
  return (
    <div className="grid gap-4">
      <Field label="Sản phẩm áp dụng" className="sm:max-w-sm">
        <NativeSelect
          name="product_scope"
          value={scope}
          onChange={(e) => {
            setScope(e.target.value);
            setObjects([]); // changePromotionMethod: doi loai -> bo cac san pham da chon
          }}
        >
          {Object.entries(scopes).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Sản phẩm">
        <PickedBox
          items={selected}
          disabled={all}
          disabledText="Áp dụng cho toàn bộ sản phẩm"
          onOpen={() => setOpen(true)}
          onRemove={(k) => setObjects((prev) => prev.filter((o) => o.id !== k))}
        />
      </Field>
      {objects.map((o) => (
        <span key={o.id} hidden>
          <input type="hidden" name="object[id][]" value={o.id} />
          <input type="hidden" name="object[name][]" value={o.name} />
        </span>
      ))}
      <div className="grid gap-4 sm:grid-cols-2">
        <Discount prefix="PRODUCT_VOUCHER" init={init.product ?? DEFAULTS} />
      </div>
      <PickerDialog
        open={open}
        onOpenChange={setOpen}
        load={loadProducts}
        selected={selected}
        onConfirm={(items) => setObjects(items.map((it) => ({ id: it.key, name: it.name })))}
      />
    </div>
  );
}

/** Thoi gian ap dung voucher (component/aside.blade.php) */
export function VoucherSchedule({ startDate, endDate, errors }: { startDate: string; endDate: string; errors: { start?: string; end?: string } }) {
  const [start, setStart] = useState(startDate);
  const [end, setEnd] = useState(endDate);
  return (
    <div className="grid gap-4">
      <Field label="Ngày bắt đầu" required htmlFor="start_date" error={errors.start}>
        <DateTimeInput id="start_date" name="start_date" value={start} onChange={setStart} invalid={Boolean(errors.start)} />
      </Field>
      <Field label="Ngày kết thúc" required htmlFor="end_date" error={errors.end}>
        <DateTimeInput id="end_date" name="end_date" value={end} onChange={setEnd} invalid={Boolean(errors.end)} />
      </Field>
    </div>
  );
}
