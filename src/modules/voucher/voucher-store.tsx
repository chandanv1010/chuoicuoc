import { Field } from "@/components/admin/fields";
import { AdminForm, FormErrors, PageHeader, Section } from "@/components/admin/page";
import { Input, Textarea } from "@/components/ui/form-controls";
import { errorBag } from "@/lib/flash";
import { convertDateTime } from "@/lib/helpers";
import { formatMoneyInput } from "@/lib/money";
import { __ } from "@/lib/lang";
import { laravelOld } from "@/modules/promotion/old";
import { IntInput } from "@/modules/promotion/ui";
import { VoucherEnum, type VoucherRow, type voucherConditions } from "./voucher";
import { VoucherDetail, VoucherSchedule, type VoucherDetailInit, type VoucherValues } from "./voucher-form";

type Conditions = Awaited<ReturnType<typeof voucherConditions>>;
type Arr = Record<string, unknown>;

/** Ban VND: convert_price($price, true). USD: "1,234.50", null -> "0.00" */
const priceFmt = (v: unknown) => formatMoneyInput(v ?? 0);
const s = (v: unknown) => (v === null || v === undefined ? "" : String(v));
const obj = (v: unknown): Arr | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Arr) : null);
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : v && typeof v === "object" ? Object.values(v) : []);

/** Doc { min_x_value, max_x_value, max_discount_amount, discount_value, discount_type } (old() hoac du lieu luu). */
function values(v: unknown, kind: "order" | "shipping" | null): VoucherValues | null {
  const o = obj(v);
  if (!o) return null;
  return {
    min: kind ? s(o[`min_${kind}_value`]) : "",
    max: kind ? s(o[`max_${kind}_value`]) : "",
    max_discount_amount: s(o.max_discount_amount),
    discount_value: s(o.discount_value),
    discount_type: s(o.discount_type) || "FIXED",
  };
}

/** resources/views/backend/voucher/store.blade.php (+ component/general, detail, aside) */
export async function VoucherStore({
  method,
  voucher,
  conditions,
  object,
}: {
  method: "create" | "edit";
  voucher: VoucherRow | null;
  conditions: Conditions | null;
  object: { id: number[]; name: (string | null)[] } | null;
}) {
  const [old, errors] = await Promise.all([laravelOld(), errorBag()]);
  const seo = __<Record<string, { title: string }>>("messages.voucher");
  const url = method === "create" ? "/voucher/store" : `/voucher/${voucher?.id}/update`;

  // Gia tri da luu dat vao .input_voucher_total_order / .input_voucher_ship / .input_product_and_quantity
  let totalOrder: Arr | null = null;
  let ship: Arr | null = null;
  let productVoucher: Arr | null = null;
  if (voucher) {
    const base = { max_discount_amount: priceFmt(voucher.max_discount_amount), discount_value: priceFmt(voucher.discount_value), discount_type: voucher.discount_type };
    if (voucher.method === VoucherEnum.TOTAL_ORDERS) {
      totalOrder = { ...base, min_order_value: priceFmt(conditions?.order?.min_order_value), max_order_value: priceFmt(conditions?.order?.max_order_value) };
    } else if (voucher.method === VoucherEnum.SHIPPING_ORDERS) {
      ship = { ...base, min_shipping_value: priceFmt(conditions?.shipping?.min_shipping_value), max_shipping_value: priceFmt(conditions?.shipping?.max_shipping_value) };
    } else if (voucher.method === VoucherEnum.PRODUCT_VOUCHER) {
      productVoucher = base;
    }
  }
  const o = obj(old("object", object));
  const names = list(o?.name);
  const init: VoucherDetailInit = {
    method: s(old("method", voucher?.method ?? null)),
    productScope: s(old("product_scope", voucher?.product_scope ?? null)),
    totalOrder: values(old("TOTAL_ORDERS", totalOrder), "order"),
    shipping: values(old("SHIPPING_ORDERS", ship), "shipping"),
    product: values(old("PRODUCT_VOUCHER", productVoucher), null),
    object: list(o?.id).map((id, i) => ({ id: s(id), name: s(names[i]) })),
  };
  const combine = VoucherEnum.COMBINE_PROMOTION;
  const combineChecked = old("name", undefined) !== undefined ? s(old("combine_promotion", null)) !== "" : voucher !== null && Number(voucher.combine_promotion) === combine;

  return (
    <>
      <PageHeader title={seo[method].title} crumbs={[{ label: seo.index.title, href: "/voucher/index" }, { label: seo[method].title }]} />
      <FormErrors />
      <AdminForm
        action={url}
        cancelHref="/voucher/index"
        saveMode="single"
        main={
          <>
            <Section title="Thông tin chung">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Tên voucher" required htmlFor="name" error={errors.first("name")}>
                  <Input id="name" name="name" defaultValue={s(old("name", voucher?.name ?? ""))} placeholder="Nhập vào tên voucher" autoComplete="off" aria-invalid={errors.has("name") || undefined} />
                </Field>
                <Field label="Mã voucher" htmlFor="code" error={errors.first("code")} hint="Để trống hệ thống sẽ tự tạo mã">
                  <Input id="code" name="code" defaultValue={s(old("code", voucher?.code ?? ""))} placeholder="Nhập mã voucher" autoComplete="off" aria-invalid={errors.has("code") || undefined} />
                </Field>
                <Field label="Số lượng" required htmlFor="total_quantity" error={errors.first("total_quantity")}>
                  <IntInput id="total_quantity" name="total_quantity" defaultValue={s(old("total_quantity", voucher?.total_quantity ?? ""))} allowEmpty placeholder="" />
                </Field>
                <Field label="Số lần sử dụng / người dùng" required htmlFor="max_usage_per_user" error={errors.first("max_usage_per_user")}>
                  <IntInput id="max_usage_per_user" name="max_usage_per_user" defaultValue={s(old("max_usage_per_user", voucher?.max_usage_per_user ?? ""))} allowEmpty placeholder="" />
                </Field>
              </div>
              <Field label="Mô tả voucher" htmlFor="description">
                <Textarea id="description" name="description" defaultValue={s(old("description", voucher?.description ?? ""))} placeholder="Nhập vào mô tả của voucher..." className="min-h-24" />
              </Field>
            </Section>
            <Section title="Cài đặt thông tin chi tiết voucher">
              <VoucherDetail init={init} methods={__<Record<string, string>>("module.voucher")} scopes={__<Record<string, string>>("module.item_voucher")} />
            </Section>
          </>
        }
        aside={
          <>
            <Section title="Thời gian áp dụng">
              <VoucherSchedule
                startDate={s(old("start_date", voucher?.start_date ? convertDateTime(voucher.start_date) : null))}
                endDate={s(old("end_date", voucher?.end_date ? convertDateTime(voucher.end_date) : null))}
                errors={{ start: errors.first("start_date"), end: errors.first("end_date") }}
              />
            </Section>
            <Section title="Cộng dồn khuyến mại">
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" name="combine_promotion" value={String(combine)} defaultChecked={combineChecked} className="mt-0.5 size-4 accent-primary" />
                Áp dụng chung với chương trình khuyến mại
              </label>
            </Section>
          </>
        }
      />
    </>
  );
}
