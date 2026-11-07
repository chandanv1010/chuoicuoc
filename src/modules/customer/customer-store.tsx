import { Field, ImageField } from "@/components/admin/fields";
import { AdminForm, FormErrors, PageHeader, Section } from "@/components/admin/page";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/form-controls";
import { errorBag, oldInput } from "@/lib/flash";
import type { findCustomer } from "./customer";
import { LocationSelect } from "./location-select";

type Customer = Awaited<ReturnType<typeof findCustomer>>;
type Option = { id: bigint; name: string };

const dateYmd = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : "");

/**
 * resources/views/backend/customer/customer/store.blade.php (+ location.js).
 * Ten truong giu nguyen cho handler customer/store, customer/{id}/update.
 */
export async function CustomerStore({
  method,
  customer,
  provinces,
  customerCatalogues,
  sources,
}: {
  method: "create" | "edit";
  customer: Customer;
  provinces: { code: string; name: string }[];
  customerCatalogues: Option[];
  sources: Option[];
}) {
  const [old, errors] = await Promise.all([oldInput(), errorBag()]);
  const url = method === "create" ? "/customer/store" : `/customer/${customer?.id}/update`;
  const v = (name: string, value: unknown) => String(old(name, value ?? "") ?? "");
  const catalogueId = v("customer_catalogue_id", customer?.customer_catalogue_id?.toString() ?? "") || "0";
  const sourceId = v("source_id", customer?.source_id?.toString() ?? "") || "0";
  // value="{{ old('code', ($customer->code) ?? time()) }}"
  const code = v("code", customer?.code ?? String(Math.floor(Date.now() / 1000)));
  const location = {
    province_id: customer?.province_id ?? v("province_id", ""),
    district_id: customer?.district_id ?? v("district_id", ""),
    ward_id: customer?.ward_id ?? v("ward_id", ""),
  };
  // lang messages.customer cua ban goc ghi nham "nhom khach hang" -> dat tieu de rieng
  const title = method === "create" ? "Thêm mới khách hàng" : "Cập nhật khách hàng";

  return (
    <>
      <PageHeader title={title} crumbs={[{ label: "Quản lý khách hàng", href: "/customer/index" }, { label: title }]} />
      <FormErrors />
      <AdminForm
        action={url}
        cancelHref="/customer/index"
        saveMode="single"
        main={
          <>
            <Section title="Thông tin chung" description="Nhập thông tin chung của khách hàng. Trường có dấu * là bắt buộc.">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Họ tên" required error={errors.first("name")}>
                  <Input name="name" defaultValue={v("name", customer?.name)} autoComplete="off" aria-invalid={errors.has("name")} />
                </Field>
                <Field label="Email" required error={errors.first("email")}>
                  <Input name="email" defaultValue={v("email", customer?.email)} autoComplete="off" aria-invalid={errors.has("email")} />
                </Field>
                <Field label="Mã khách hàng">
                  <Input name="code" defaultValue={code} readOnly className="bg-muted/50" />
                </Field>
                <Field label="Ngày sinh">
                  <Input type="date" name="birthday" defaultValue={v("birthday", dateYmd(customer?.birthday))} />
                </Field>
                <Field label="Nhóm khách hàng" required error={errors.first("customer_catalogue_id")}>
                  <Combobox
                    name="customer_catalogue_id"
                    defaultValue={catalogueId}
                    options={[{ value: "0", label: "[Chọn Nhóm Khách Hàng]" }, ...customerCatalogues.map((c) => ({ value: c.id.toString(), label: c.name }))]}
                  />
                </Field>
                <Field label="Nguồn khách">
                  <Combobox
                    name="source_id"
                    defaultValue={sourceId}
                    options={[{ value: "0", label: "[Chọn Nguồn khách]" }, ...sources.map((s) => ({ value: s.id.toString(), label: s.name }))]}
                  />
                </Field>
              </div>
              {method === "create" && (
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Mật khẩu" required error={errors.first("password")}>
                    <Input type="password" name="password" autoComplete="new-password" aria-invalid={errors.has("password")} />
                  </Field>
                  <Field label="Nhập lại mật khẩu" required error={errors.first("re_password")}>
                    <Input type="password" name="re_password" autoComplete="new-password" aria-invalid={errors.has("re_password")} />
                  </Field>
                </div>
              )}
            </Section>
            <Section title="Thông tin liên hệ" description="Địa chỉ, số điện thoại và ghi chú">
              <LocationSelect provinces={provinces} defaultValue={location} className="md:grid-cols-3" />
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Địa chỉ">
                  <Input name="address" defaultValue={v("address", customer?.address)} autoComplete="off" />
                </Field>
                <Field label="Số điện thoại">
                  <Input name="phone" defaultValue={v("phone", customer?.phone)} autoComplete="off" />
                </Field>
              </div>
              <Field label="Ghi chú">
                <Input name="description" defaultValue={v("description", customer?.description)} autoComplete="off" />
              </Field>
            </Section>
          </>
        }
        aside={
          <Section title="Ảnh đại diện">
            <ImageField name="image" defaultValue={v("image", customer?.image)} aspect="aspect-square" />
          </Section>
        }
      />
    </>
  );
}
