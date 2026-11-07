import { Field } from "@/components/admin/fields";
import { Input, NativeSelect, Textarea } from "@/components/ui/form-controls";
import type { PublicAccount } from "./accounts";
import { TaxonomyPicker } from "./taxonomy-picker";
import type { ListingSettings } from "./types";

/** Cac truong lua chon dang len san (dung chung cho "Mac dinh cua tai khoan" va khoi o trang sua san pham). */

const WHEN_MADE = [
  ["made_to_order", "Made to order (làm theo đơn)"],
  ["2020_2026", "2020 – 2026"],
  ["2010_2019", "2010 – 2019"],
] as const;

const WHO_MADE = [
  ["i_did", "Tôi / xưởng của tôi làm"],
  ["collective", "Nhóm / tập thể làm"],
  ["someone_else", "Đối tác sản xuất làm"],
] as const;

function Options({ list, value, empty }: { list: { id: string; name: string }[]; value?: string; empty: string }) {
  return (
    <>
      <option value="">{empty}</option>
      {list.map((o) => (
        <option key={o.id} value={o.id}>
          {o.name}
        </option>
      ))}
      {value && !list.some((o) => o.id === value) && <option value={value}>#{value} (không còn trong danh sách)</option>}
    </>
  );
}

const PUBLISH_LABEL: Record<string, [string, string]> = {
  shopee: ["Ẩn (Unlist) — tự kiểm tra rồi hiện trên Seller Centre", "Đăng bán ngay"],
  lazada: ["Tạo rồi tắt bán (Inactive)", "Đăng bán (qua kiểm duyệt của Lazada)"],
  tiktok_shop: ["Bản nháp (Draft)", "Gửi duyệt & đăng bán"],
  amazon: ["Chỉ kiểm tra với Amazon (chưa tạo listing)", "Tạo listing thật"],
};

const SHIPPING_LABEL: Record<string, string> = { shopee: "Đơn vị vận chuyển (trống = mọi đơn vị shop đã bật)", tiktok_shop: "Kho hàng" };

const num = (v: number | null | undefined) => (v === null || v === undefined ? "" : v);

/** Truong cho Shopee / Lazada / TikTok Shop / Amazon. */
function MarketFields({ account, s, product }: { account: PublicAccount; s: Partial<ListingSettings>; product?: { name: string } }) {
  const m = account.platform;
  const amazon = m === "amazon";
  const vnd = !amazon;
  return (
    <div className="grid gap-4">
      {product && (
        <>
          <Field label="Tiêu đề trên sàn" hint={amazon ? "Để trống = tên sản phẩm. Amazon tối đa 200 ký tự." : "Để trống = tên sản phẩm. Viết tiếng Việt cho khách VN, từ khóa chính ở đầu."}>
            <Input name="title" defaultValue={s.title ?? ""} placeholder={product.name} maxLength={255} />
          </Field>
          <Field label="Mô tả trên sàn" hint="Để trống = mô tả ngắn của sản phẩm (tự bỏ định dạng HTML).">
            <Textarea name="description" defaultValue={s.description ?? ""} className="min-h-24" />
          </Field>
        </>
      )}
      <Field
        label={amazon ? "Product type Amazon" : "Danh mục trên sàn"}
        hint={amazon ? "Tìm bằng tiếng Anh (hat, napkin, shirt) rồi chọn; thuộc tính bắt buộc hiện bên dưới." : "Bắt buộc, chỉ chọn được danh mục cuối cùng. Thuộc tính bắt buộc của danh mục hiện bên dưới."}
      >
        <TaxonomyPicker
          platform={m}
          accountId={account.id}
          defaultId={s.category_id}
          defaultLabel={s.category_label}
          placeholder={amazon ? "Tìm product type: hat, napkin…" : "Tìm danh mục: mũ, khăn ăn, áo thun…"}
          withAttributes
          defaultAttributes={s.attributes}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Thương hiệu" hint={amazon ? "Trống = Generic. Thương hiệu riêng cần Brand Registry." : "Trống = No brand. Thương hiệu riêng phải đăng ký trên sàn trước."}>
          <Input name="brand" defaultValue={s.brand ?? ""} placeholder={amazon ? "Generic" : "No brand"} />
        </Field>
        {SHIPPING_LABEL[m] && (
          <Field label={SHIPPING_LABEL[m]}>
            <NativeSelect name="shipping_profile_id" defaultValue={s.shipping_profile_id ?? ""}>
              <Options list={account.shipping_profiles} value={s.shipping_profile_id} empty={m === "shopee" ? "— Tất cả đơn vị đã bật —" : "— Kho mặc định —"} />
            </NativeSelect>
          </Field>
        )}
        <Field label="Chế độ đăng">
          <NativeSelect name="publish" defaultValue={s.publish ?? "draft"}>
            <option value="draft">{PUBLISH_LABEL[m]?.[0] ?? "Bản nháp"}</option>
            <option value="active">{PUBLISH_LABEL[m]?.[1] ?? "Đăng bán ngay"}</option>
          </NativeSelect>
        </Field>
        {vnd && (
          <Field label="Tỷ giá (VND cho 1 USD giá website)" hint="Giá web × tỷ giá, làm tròn 1.000đ. Bỏ trống nếu nhập giá trên sàn.">
            <Input name="fx_rate" type="number" step="1" min="0" defaultValue={num(s.fx_rate)} placeholder="vd 26000" />
          </Field>
        )}
      </div>
      {!amazon && (
        <fieldset className="grid gap-3 rounded-md border p-3">
          <legend className="px-1 text-sm font-medium">Gói hàng (để sàn tính phí ship)</legend>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="Cân nặng (kg)">
              <Input name="weight_kg" type="number" step="0.01" min="0" defaultValue={num(s.weight_kg)} placeholder="0.2" />
            </Field>
            <Field label="Dài (cm)">
              <Input name="length_cm" type="number" step="1" min="0" defaultValue={num(s.length_cm)} />
            </Field>
            <Field label="Rộng (cm)">
              <Input name="width_cm" type="number" step="1" min="0" defaultValue={num(s.width_cm)} />
            </Field>
            <Field label="Cao (cm)">
              <Input name="height_cm" type="number" step="1" min="0" defaultValue={num(s.height_cm)} />
            </Field>
          </div>
        </fieldset>
      )}
      {amazon && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Mã vạch UPC / EAN" hint="Trống = xin miễn GTIN (cần Amazon duyệt miễn cho danh mục/thương hiệu).">
            <Input name="gtin" defaultValue={s.gtin ?? ""} inputMode="numeric" placeholder="12 hoặc 13 số" />
          </Field>
          <Field label="Variation theme (khi có biến thể)" hint="Trống = tự đoán từ tên nhóm biến thể (COLOR, SIZE, COLOR_SIZE…).">
            <Input name="variation_theme" defaultValue={s.variation_theme ?? ""} placeholder="COLOR" />
          </Field>
          <Field label="Từ khóa tìm kiếm (search terms)" hint="Cách nhau bằng dấu phẩy, tổng ≤ 250 ký tự.">
            <Input name="tags" defaultValue={(s.tags ?? []).join(", ")} />
          </Field>
          <Field label="Chất liệu">
            <Input name="materials" defaultValue={(s.materials ?? []).join(", ")} placeholder="Cotton, Polyester" />
          </Field>
        </div>
      )}
      {product && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={`Giá trên sàn (${vnd ? "VND" : "USD"})`} hint="Để trống = tính từ giá website / giá từng phiên bản.">
            <Input name="price_override" type="number" step={vnd ? "1000" : "0.01"} min="0" defaultValue={s.price_override ?? ""} placeholder={vnd ? "vd 350000" : "vd 38.00"} />
          </Field>
          {!amazon && (
            <label className="flex items-center gap-2 self-end pb-2 text-sm">
              <input type="checkbox" name="replace_images" value="1" defaultChecked={Boolean(s.replace_images)} className="size-4" /> Tải lại toàn bộ ảnh khi đồng bộ
            </label>
          )}
        </div>
      )}
    </div>
  );
}

export function ListingFields({ account, s, product }: { account: PublicAccount; s: Partial<ListingSettings>; product?: { name: string } }) {
  if (account.platform !== "etsy") return <MarketFields account={account} s={s} product={product} />;
  const p = s.personalization;
  return (
    <div className="grid gap-4">
      {product && (
        <>
          <Field label="Tiêu đề trên sàn" hint="Để trống = tên sản phẩm. Etsy tối đa 140 ký tự; nên mở đầu bằng từ khóa khách hay tìm.">
            <Input name="title" defaultValue={s.title ?? ""} placeholder={product.name} maxLength={140} />
          </Field>
          <Field label="Mô tả trên sàn" hint="Để trống = mô tả ngắn của sản phẩm (tự bỏ định dạng HTML).">
            <Textarea name="description" defaultValue={s.description ?? ""} className="min-h-24" />
          </Field>
        </>
      )}
      <Field label="Danh mục Etsy" hint="Bắt buộc. Tìm bằng tiếng Anh rồi chọn; danh mục đúng giúp Etsy hiển thị sản phẩm cho đúng khách.">
        <TaxonomyPicker defaultId={s.category_id} defaultLabel={s.category_label} />
      </Field>
      <Field label="Tag (tối đa 13, mỗi tag ≤ 20 ký tự)" hint="Cách nhau bằng dấu phẩy. Ví dụ: custom dad hat, embroidered cap, gift for him">
        <Textarea name="tags" defaultValue={(s.tags ?? []).join(", ")} className="min-h-16" />
      </Field>
      <Field label="Chất liệu (tối đa 13)" hint="Cách nhau bằng dấu phẩy. Ví dụ: cotton twill, polyester thread">
        <Input name="materials" defaultValue={(s.materials ?? []).join(", ")} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Ai làm sản phẩm">
          <NativeSelect name="who_made" defaultValue={s.who_made ?? "i_did"}>
            {WHO_MADE.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Làm khi nào">
          <NativeSelect name="when_made" defaultValue={s.when_made ?? "made_to_order"}>
            {WHEN_MADE.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Vận chuyển (shipping profile)">
          <NativeSelect name="shipping_profile_id" defaultValue={s.shipping_profile_id ?? ""}>
            <Options list={account.shipping_profiles} value={s.shipping_profile_id} empty="— Chọn —" />
          </NativeSelect>
        </Field>
        <Field label="Thời gian làm hàng (processing profile)">
          <NativeSelect name="processing_profile_id" defaultValue={s.processing_profile_id ?? ""}>
            <Options list={account.processing_profiles} value={s.processing_profile_id} empty="— Chọn —" />
          </NativeSelect>
        </Field>
        <Field label="Chính sách đổi trả">
          <NativeSelect name="return_policy_id" defaultValue={s.return_policy_id ?? ""}>
            <Options list={account.return_policies} value={s.return_policy_id} empty="— Chọn —" />
          </NativeSelect>
        </Field>
        <Field label="Chế độ đăng">
          <NativeSelect name="publish" defaultValue={s.publish ?? "draft"}>
            <option value="draft">Bản nháp (tự kiểm tra rồi bấm Publish trên Etsy)</option>
            <option value="active">Đăng bán ngay (mất phí $0.20)</option>
          </NativeSelect>
        </Field>
      </div>
      {product && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Giá trên sàn (USD)" hint="Để trống = giá website / giá từng phiên bản. Nhớ đã cộng phí ship nếu để Free shipping.">
            <Input name="price_override" type="number" step="0.01" min="0" defaultValue={s.price_override ?? ""} placeholder="vd 38.00" />
          </Field>
          <label className="flex items-center gap-2 self-end pb-2 text-sm">
            <input type="checkbox" name="replace_images" value="1" defaultChecked={Boolean(s.replace_images)} className="size-4" /> Tải lại toàn bộ ảnh khi đồng bộ
          </label>
        </div>
      )}
      <fieldset className="grid gap-3 rounded-md border p-3">
        <legend className="px-1 text-sm font-medium">Ô cá nhân hóa (khách nhập tên / chữ cần thêu)</legend>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="pers_enabled" value="1" defaultChecked={Boolean(p?.enabled)} className="size-4" /> Bật
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="pers_required" value="1" defaultChecked={p?.required ?? true} className="size-4" /> Bắt buộc nhập
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
          <Field label="Câu hỏi (≤ 45 ký tự)">
            <Input name="pers_question" defaultValue={p?.question ?? "Personalization"} maxLength={45} />
          </Field>
          <Field label="Tối đa ký tự">
            <Input name="pers_max" type="number" min={1} max={1024} defaultValue={p?.max_chars ?? 100} />
          </Field>
        </div>
        <Field label="Hướng dẫn cho khách">
          <Textarea name="pers_instructions" defaultValue={p?.instructions ?? ""} placeholder={"Enter the name to embroider (max 12 letters).\nThread color: white, gold or navy."} className="min-h-16" />
        </Field>
      </fieldset>
    </div>
  );
}
