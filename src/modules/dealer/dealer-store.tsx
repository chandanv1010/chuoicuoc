import { Field } from "@/components/admin/fields";
import { AdminForm, FormErrors, PageHeader, Section } from "@/components/admin/page";
import { Input, NativeSelect } from "@/components/ui/form-controls";
import { errorBag, oldInput } from "@/lib/flash";
import { __ } from "@/lib/lang";
import { e } from "@/modules/slide/php";
import { LOAI, type DealerRow } from "./dealer";
import { CoordinateFields } from "./coordinate-fields";
import { LocationSelect } from "./location-select";

/** resources/views/backend/dealer/store.blade.php — POST dealer/store | dealer/{id}/update */
export async function DealerStore({ method, dealer, provinces }: { method: "create" | "edit"; dealer: DealerRow | null; provinces: { code: string; name: string }[] }) {
  const [old, errors] = await Promise.all([oldInput(), errorBag()]);
  const seo = __<Record<string, { title: string }>>("messages.dealer");
  const url = method === "create" ? "/dealer/store" : `/dealer/${dealer?.id}/update`;
  const v = (k: string, fallback: unknown) => e(old(k, fallback));
  const type = v("type", dealer?.type ?? "dealer");
  const publish = v("publish", dealer?.publish ?? 2);
  const featured = isTruthy(old<unknown>("is_featured", dealer?.is_featured ?? 0));
  const title = seo[method].title;

  return (
    <>
      <PageHeader title={title} crumbs={[{ label: seo.index.title, href: "/dealer/index" }, { label: title }]} />
      <FormErrors />
      <AdminForm
        action={url}
        cancelHref="/dealer/index"
        saveMode="single"
        main={
          <>
            <Section title="Thông tin điểm bán">
              <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
                <Field label="Tên điểm bán" required error={errors.first("name")}>
                  <Input name="name" defaultValue={v("name", dealer?.name ?? "")} autoComplete="off" aria-invalid={errors.has("name")} />
                </Field>
                <Field label="Điện thoại" error={errors.first("phone")}>
                  <Input name="phone" defaultValue={v("phone", dealer?.phone ?? "")} autoComplete="off" />
                </Field>
              </div>
              <LocationSelect
                provinces={provinces.map((p) => ({ value: p.code, label: p.name }))}
                province={v("province_code", dealer?.province_code ?? "")}
                district={v("district_code", dealer?.district_code ?? "")}
                ward={v("ward_code", dealer?.ward_code ?? "")}
              />
              <Field label="Địa chỉ chi tiết" error={errors.first("address")}>
                <Input name="address" defaultValue={v("address", dealer?.address ?? "")} placeholder="Số nhà, tên đường" autoComplete="off" />
              </Field>
            </Section>
            <Section
              title="Tọa độ trên bản đồ"
              description="Mở Google Maps, bấm chuột phải vào vị trí cửa hàng, dòng số đầu tiên là “vĩ độ, kinh độ” — bấm để sao chép rồi dán vào ô bên dưới. Bỏ trống thì điểm này không hiện trên bản đồ (vẫn có trong danh sách đại lý)."
            >
              <CoordinateFields
                latitude={v("latitude", dealer?.latitude ?? "")}
                longitude={v("longitude", dealer?.longitude ?? "")}
                errors={{ latitude: errors.first("latitude"), longitude: errors.first("longitude") }}
              />
            </Section>
          </>
        }
        aside={
          <Section title="Phân loại & hiển thị">
            <Field label="Loại điểm bán" required error={errors.first("type")}>
              <NativeSelect name="type" defaultValue={type in LOAI ? type : "dealer"}>
                {Object.entries(LOAI).map(([ma, ten]) => (
                  <option key={ma} value={ma}>
                    {ten}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Thứ tự" error={errors.first("order")}>
              <Input type="number" name="order" min={0} defaultValue={v("order", dealer?.order ?? 0)} />
            </Field>
            <label className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
              Đại lý nổi bật
              <input type="checkbox" name="is_featured" value="1" defaultChecked={featured} className="size-4 accent-primary" />
            </label>
            <Field label="Trạng thái hiển thị">
              <NativeSelect name="publish" defaultValue={publish === "1" ? "1" : "2"}>
                <option value="2">Hiển thị</option>
                <option value="1">Ẩn</option>
              </NativeSelect>
            </Field>
          </Section>
        }
      />
    </>
  );
}

/** Truthy kieu PHP */
function isTruthy(v: unknown) {
  if (v === null || v === undefined || v === false) return false;
  const s = String(v);
  return s !== "" && s !== "0";
}
