import { Field, ImageField } from "@/components/admin/fields";
import { AdminForm, FormErrors, PageHeader, Section } from "@/components/admin/page";
import { Input, NativeSelect, Textarea } from "@/components/ui/form-controls";
import { errorBag, oldInput } from "@/lib/flash";
import { __ } from "@/lib/lang";
import { e } from "@/modules/slide/php";
import { findAreaByParentId } from "./distribution";
import { RegionAreaSelect } from "./region-select";

/** resources/views/backend/distribution/store.blade.php — POST distribution/store | distribution/{id}/update */
type Distribution = {
  id: bigint;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  image: string | null;
  map: string | null;
  province_id: bigint | null;
  district_id: bigint | null;
  publish: number;
} | null;
type Area = { id: bigint; name: string };

export async function DistributionStore({ method, distribution, regions }: { method: "create" | "edit"; distribution: Distribution; regions: Area[]; areas?: Area[] }) {
  const [old, errors] = await Promise.all([oldInput(), errorBag()]);
  const seo = __<Record<string, { title: string }>>("messages.distribution");
  const url = method === "create" ? "/distribution/store" : `/distribution/${distribution?.id}/update`;
  const v = (k: string, fallback: unknown) => e(old(k, fallback));
  const provinceId = v("province_id", distribution?.province_id ?? 0);
  const districtId = v("district_id", distribution?.district_id ?? 0);
  const publish = v("publish", distribution?.publish ?? 2);
  const n = Number.parseInt(provinceId, 10);
  const areas = n > 0 ? await findAreaByParentId(n) : [];
  const title = seo[method].title;
  const map = v("map", distribution?.map ?? "");

  return (
    <>
      <PageHeader title={title} crumbs={[{ label: seo.index.title, href: "/distribution/index" }, { label: title }]} />
      <FormErrors />
      <AdminForm
        action={url}
        cancelHref="/distribution/index"
        saveMode="single"
        main={
          <>
            <Section title="Thông tin nhà phân phối">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Tên nhà phân phối" required error={errors.first("name")}>
                  <Input name="name" defaultValue={v("name", distribution?.name ?? "")} autoComplete="off" aria-invalid={errors.has("name")} />
                </Field>
                <Field label="Số điện thoại" required error={errors.first("phone")}>
                  <Input name="phone" defaultValue={v("phone", distribution?.phone ?? "")} autoComplete="off" aria-invalid={errors.has("phone")} />
                </Field>
                <Field label="Email" error={errors.first("email")}>
                  <Input name="email" defaultValue={v("email", distribution?.email ?? "")} autoComplete="off" aria-invalid={errors.has("email")} />
                </Field>
                <Field label="Địa chỉ" required error={errors.first("address")}>
                  <Input name="address" defaultValue={v("address", distribution?.address ?? "")} autoComplete="off" aria-invalid={errors.has("address")} />
                </Field>
                <RegionAreaSelect
                  regions={regions.map((r) => ({ id: r.id.toString(), name: r.name }))}
                  areas={areas.map((a) => ({ id: a.id.toString(), name: a.name }))}
                  provinceId={provinceId}
                  districtId={districtId}
                  errors={{ province_id: errors.first("province_id"), district_id: errors.first("district_id") }}
                />
              </div>
            </Section>
            <Section title="Bản đồ" description="Mở Google Maps → Chia sẻ → Nhúng bản đồ, sao chép thẻ <iframe> và dán vào ô dưới.">
              <Field label="Mã nhúng Google Map (thẻ iframe)" required error={errors.first("map")}>
                <Textarea
                  name="map"
                  rows={5}
                  className="font-mono text-xs"
                  placeholder='<iframe src="https://www.google.com/maps/embed?..." width="600" height="450" style="border:0;" allowfullscreen="" loading="lazy"></iframe>'
                  defaultValue={map}
                  aria-invalid={errors.has("map")}
                />
              </Field>
            </Section>
          </>
        }
        aside={
          <>
            <Section title="Hình ảnh">
              <ImageField name="image" defaultValue={v("image", distribution?.image ?? "")} />
            </Section>
            <Section title="Trạng thái">
              <Field label="Trạng thái hiển thị">
                <NativeSelect name="publish" defaultValue={publish === "1" ? "1" : "2"}>
                  <option value="2">Hoạt động</option>
                  <option value="1">Ngừng hoạt động</option>
                </NativeSelect>
              </Field>
            </Section>
          </>
        }
      />
    </>
  );
}
