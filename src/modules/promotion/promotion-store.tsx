import { Field } from "@/components/admin/fields";
import { AdminForm, FormErrors, PageHeader, Section } from "@/components/admin/page";
import { Input, Textarea } from "@/components/ui/form-controls";
import { errorBag, getFlash } from "@/lib/flash";
import { convertDateTime } from "@/lib/helpers";
import { formatMoneyInput } from "@/lib/money";
import { __ } from "@/lib/lang";
import { laravelOld, type Old } from "./old";
import { ApplyChooser, PromotionDetail, PromotionSchedule, SourceChooser, type AudienceInit, type ComboEntry, type PromotionDetailInit, type RangeRow } from "./promotion-form";
import type { Promotion } from "./promotion";

type Arr = Record<string, unknown>;

/** Lay $model->discountInformation['a']['b'] ?? null */
function di(model: { discountInformation: Arr | null } | null, ...path: string[]): unknown {
  let node: unknown = model?.discountInformation ?? null;
  for (const p of path) {
    if (node && typeof node === "object") node = (node as Arr)[p];
    else return null;
  }
  return node ?? null;
}

const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : v && typeof v === "object" ? Object.values(v) : []);
const obj = (v: unknown): Arr | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Arr) : null);

/**
 * Dung trang thai ban dau cho form tu old() (sau loi validate) hoac du lieu da luu —
 * dung cac nguon ma store.blade.php dat vao input an (.input_order_amount_range,
 * .input_product_and_quantity, .input_object, .input_products, .input_product_gifts,
 * .input_product_combo, .preload_promotionMethod, .preload_select-...).
 */
function detailInit(promotion: Promotion | null, old: Old, products: unknown, productGifts: unknown): PromotionDetailInit {
  const info = di(promotion, "info");
  const method = str(old("method", promotion?.method ?? null));

  // .input_order_amount_range = old('promotion_order_amount_range', info)
  const range = obj(old("promotion_order_amount_range", info));
  let orderRange: RangeRow[] = [{ from: "0.00", to: "0.00", value: "0.00", type: "cash" }];
  if (range && range.amountFrom !== undefined) {
    const from = list(range.amountFrom);
    const to = list(range.amountTo);
    const value = list(range.amountValue);
    const type = list(range.amountType);
    // USD: hien "1,234.50" (gia tri cu trong JSON la so nguyen hoac chuoi)
    orderRange = from.map((f, i) => ({ from: formatMoneyInput(f), to: formatMoneyInput(to[i]), value: formatMoneyInput(value[i]), type: str(type[i]) || "cash" }));
  }

  // .input_product_and_quantity = old('product_and_quantity', info)
  const pqRaw = obj(old("product_and_quantity", info));
  const pq =
    pqRaw && pqRaw.quantity !== undefined
      ? { quantity: str(pqRaw.quantity), maxDiscountValue: str(pqRaw.maxDiscountValue), discountValue: str(pqRaw.discountValue), discountType: str(pqRaw.discountType) }
      : { quantity: "1", maxDiscountValue: "0", discountValue: "0", discountType: "cash" };

  // .input_object = old('object', info.object): {id[], product_variant_id[], variant_uuid[], name[]}
  const o = obj(old("object", di(promotion, "info", "object")));
  const ids = list(o?.id);
  const vids = list(o?.product_variant_id);
  const uuids = list(o?.variant_uuid);
  const names = list(o?.name);
  // confirmProductPromotion: gia tri rong -> 'null'
  const object = ids.map((id, i) => ({ id: str(id) || "null", variantId: str(vids[i]) || "null", uuid: str(uuids[i]) || "null", name: str(names[i]) || "null" }));

  // .input_products / .input_product_gifts = old('products', convertData(...))
  const entries = (v: unknown) => {
    const d = obj(v);
    if (!d) return [];
    const q = list(d.quantity);
    const img = list(d.image);
    const nm = list(d.name);
    return list(d.id).map((id, i) => ({ id: str(id), image: str(img[i]), name: str(nm[i]), quantity: str(q[i]) }));
  };

  // .input_product_combo = old('product_combos', info): {price, id[], uuid[], image[], name[], quantity[]}
  const c = obj(old("product_combos", info));
  let combo: { items: ComboEntry[]; price: string } = { items: [], price: "" };
  if (c && c.price !== undefined && c.price !== null) {
    const cu = list(c.uuid);
    const ci = list(c.image);
    const cn = list(c.name);
    const cq = list(c.quantity);
    // Ban goc khong nap lai uuid (oldChooseData) -> sua lai bi loi; o day giu uuid da luu
    combo = { price: str(c.price), items: list(c.id).map((id, i) => ({ id: str(id), uuid: str(cu[i] ?? null), image: str(ci[i]), name: str(cn[i]), quantity: str(cq[i]) })) };
  }

  return {
    method,
    moduleType: str(old("module_type", di(promotion, "info", "model"))),
    orderRange,
    pq,
    object,
    products: entries(old("products", products)),
    gifts: entries(old("product_gifts", productGifts)),
    combo,
  };
}

function audienceInit(promotion: Promotion | null, old: Old): AudienceInit {
  const applyValue = list(old("applyValue", di(promotion, "apply", "data")) ?? []).map(str);
  const conditions: Record<string, string[]> = {};
  for (const v of applyValue) conditions[v] = list(old(v, di(promotion, "apply", "condition", v))).map(str);
  return {
    sourceStatus: str(old("source", di(promotion, "source", "status"))),
    sourceValue: list(old("sourceValue", di(promotion, "source", "data")) ?? []).map(str),
    applyStatus: str(old("applyStatus", di(promotion, "apply", "status"))),
    applyValue,
    conditions,
  };
}

/** resources/views/backend/promotion/promotion/store.blade.php (+ component/general, detail, aside) */
export async function PromotionStore({
  method,
  promotion,
  sources,
  products,
  productGifts,
}: {
  method: "create" | "edit";
  promotion: Promotion | null;
  sources: { id: bigint; name: string }[];
  products: unknown; // convertData(..., 'products') hoac null khi tao moi
  productGifts: unknown;
}) {
  const [old, errors, flashed] = await Promise.all([laravelOld(), errorBag(), getFlash()]);
  const seo = __<Record<string, { title: string }>>("messages.promotion");
  // lang chi co promotion.create (Blade dung chung tieu de create cho ca trang sua)
  const title = method === "edit" ? "Cập nhật Khuyến mại" : seo.create.title;
  const url = method === "create" ? "/promotion/store" : `/promotion/${promotion?.id}/update`;
  // Ban goc an 'buy_combo' trong lang (module.promotion) nhung service/validate van ho tro -> hien lai
  const methods: Record<string, string> = { ...__<Record<string, string>>("module.promotion"), buy_combo: "Mua theo combo" };
  const applyList = __<{ id: string; name: string }[]>("module.applyStatus").map((a) => ({ id: String(a.id), name: String(a.name) }));
  const neverEnd = old("neverEndDate", promotion?.neverEndDate ?? null) === "accept";
  const methodErrors = flashed.errors?.method ?? [];

  return (
    <>
      <PageHeader title={title} crumbs={[{ label: seo.index.title, href: "/promotion/index" }, { label: title }]} />
      <FormErrors />
      <AdminForm
        action={url}
        cancelHref="/promotion/index"
        saveMode="single"
        main={
          <>
            <Section title="Thông tin chung">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Tên chương trình" required htmlFor="name" error={errors.first("name")}>
                  <Input id="name" name="name" defaultValue={str(old("name", promotion?.name ?? ""))} placeholder="Nhập vào tên khuyến mại" autoComplete="off" aria-invalid={errors.has("name") || undefined} />
                </Field>
                <Field label="Mã khuyến mại" required htmlFor="code" error={errors.first("code")}>
                  <Input id="code" name="code" defaultValue={str(old("code", promotion?.code ?? ""))} placeholder="Nhập mã khuyến mại" autoComplete="off" aria-invalid={errors.has("code") || undefined} />
                </Field>
              </div>
              <Field label="Mô tả khuyến mại" htmlFor="description">
                <Textarea id="description" name="description" defaultValue={str(old("description", promotion?.description ?? ""))} placeholder="Nhập vào mô tả của khuyến mại..." className="min-h-24" />
              </Field>
            </Section>
            <Section title="Cài đặt thông tin chi tiết khuyến mại">
              <PromotionDetail
                init={detailInit(promotion, old, products, productGifts)}
                methods={methods}
                itemModels={__<Record<string, string>>("module.item")}
                giftModules={__<Record<string, string>>("module.buy_product_take_gift")}
                errors={methodErrors}
              />
            </Section>
          </>
        }
        aside={
          <>
            <Section title="Thời gian áp dụng">
              <PromotionSchedule
                startDate={str(old("startDate", promotion?.startDate ? convertDateTime(promotion.startDate) : null))}
                endDate={str(old("endDate", promotion?.endDate ? convertDateTime(promotion.endDate) : null))}
                neverEnd={neverEnd}
                errors={{ startDate: errors.first("startDate"), endDate: errors.first("endDate") }}
              />
            </Section>
            <Section title="Nguồn khách áp dụng">
              <SourceChooser init={audienceInit(promotion, old)} sources={sources.map((s) => ({ id: s.id.toString(), name: s.name }))} />
            </Section>
            <Section title="Đối tượng áp dụng">
              <ApplyChooser init={audienceInit(promotion, old)} applyList={applyList} />
            </Section>
          </>
        }
      />
    </>
  );
}
