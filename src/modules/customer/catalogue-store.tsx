import { Field } from "@/components/admin/fields";
import { AdminForm, FormErrors, PageHeader, Section } from "@/components/admin/page";
import { Input } from "@/components/ui/form-controls";
import { errorBag, oldInput } from "@/lib/flash";
import { __ } from "@/lib/lang";
import type { findCustomerCatalogue } from "./customer";

type Catalogue = Awaited<ReturnType<typeof findCustomerCatalogue>>;

/** resources/views/backend/customer/catalogue/store.blade.php (name, description, point_percent). */
export async function CustomerCatalogueStore({ method, catalogue }: { method: "create" | "edit"; catalogue: Catalogue }) {
  const [old, errors] = await Promise.all([oldInput(), errorBag()]);
  const seo = __<Record<string, { title: string }>>("messages.customerCatalogue");
  const url = method === "create" ? "/customer/catalogue/store" : `/customer/catalogue/${catalogue?.id}/update`;
  const v = (name: string, value: unknown) => String(old(name, value ?? "") ?? "");
  const title = method === "create" ? seo.create.title : (seo.edit?.title ?? seo.create.title);
  return (
    <>
      <PageHeader title={title} crumbs={[{ label: seo.index.title, href: "/customer/catalogue/index" }, { label: title }]} />
      <FormErrors />
      <div className="max-w-3xl">
        <AdminForm
          action={url}
          cancelHref="/customer/catalogue/index"
          saveMode="single"
          main={
            <Section title="Thông tin chung" description="Nhập thông tin chung của nhóm khách hàng. Trường có dấu * là bắt buộc.">
              <Field label="Tên nhóm" required error={errors.first("name")}>
                <Input name="name" defaultValue={v("name", catalogue?.name)} autoComplete="off" aria-invalid={errors.has("name")} />
              </Field>
              <Field label="Điểm tích lũy cho nhóm (%)" hint="Phần trăm giá trị đơn hàng được quy đổi thành điểm khi đơn đã thanh toán.">
                <Input name="point_percent" inputMode="decimal" defaultValue={v("point_percent", catalogue?.point_percent)} autoComplete="off" />
              </Field>
              <Field label="Ghi chú">
                <Input name="description" defaultValue={v("description", catalogue?.description)} autoComplete="off" />
              </Field>
            </Section>
          }
        />
      </div>
    </>
  );
}
