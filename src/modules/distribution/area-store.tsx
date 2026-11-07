import { Field } from "@/components/admin/fields";
import { AdminForm, FormErrors, PageHeader, Section } from "@/components/admin/page";
import { Input, NativeSelect } from "@/components/ui/form-controls";
import { errorBag, oldInput } from "@/lib/flash";
import { __ } from "@/lib/lang";
import { e } from "@/modules/slide/php";

/** resources/views/backend/distribution_area/store.blade.php — POST distribution/area/store | {id}/update */
export async function AreaStore({
  method,
  area,
  parents,
}: {
  method: "create" | "edit";
  area: { id: bigint; name: string; parent_id: bigint; publish: number } | null;
  parents: { id: bigint; name: string }[];
}) {
  const [old, errors] = await Promise.all([oldInput(), errorBag()]);
  const seo = __<Record<string, { title: string }>>("messages.distributionArea");
  const url = method === "create" ? "/distribution/area/store" : `/distribution/area/${area?.id}/update`;
  const parentId = e(old("parent_id", area?.parent_id ?? 0));
  const publish = e(old("publish", area?.publish ?? 2));
  const title = seo[method].title;
  return (
    <>
      <PageHeader title={title} crumbs={[{ label: seo.index.title, href: "/distribution/area/index" }, { label: title }]} />
      <FormErrors />
      <AdminForm
        action={url}
        cancelHref="/distribution/area/index"
        saveMode="single"
        main={
          <Section title="Thông tin khu vực" description="Khu vực cấp cha là Miền (Bắc / Nam); khu vực con là Tỉnh / Thành phố thuộc miền đó.">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Tên khu vực" required error={errors.first("name")}>
                <Input name="name" defaultValue={e(old("name", area?.name ?? ""))} autoComplete="off" aria-invalid={errors.has("name")} />
              </Field>
              <Field label="Khu vực cha" required error={errors.first("parent_id")}>
                <NativeSelect name="parent_id" defaultValue={parentId === "0" || parents.some((p) => p.id.toString() === parentId) ? parentId : "0"}>
                  <option value="0">Là danh mục cha (Miền Bắc / Miền Nam)</option>
                  {parents
                    .filter((p) => p.id !== area?.id)
                    .map((p) => (
                      <option key={p.id.toString()} value={p.id.toString()}>
                        {p.name}
                      </option>
                    ))}
                </NativeSelect>
              </Field>
            </div>
          </Section>
        }
        aside={
          <Section title="Trạng thái">
            <Field label="Trạng thái hiển thị">
              <NativeSelect name="publish" defaultValue={publish === "1" ? "1" : "2"}>
                <option value="2">Hoạt động</option>
                <option value="1">Ngừng hoạt động</option>
              </NativeSelect>
            </Field>
          </Section>
        }
      />
    </>
  );
}
