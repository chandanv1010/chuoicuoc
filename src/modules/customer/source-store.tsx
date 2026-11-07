import { Field } from "@/components/admin/fields";
import { AdminForm, FormErrors, PageHeader, Section } from "@/components/admin/page";
import { RichTextEditor } from "@/components/admin/rich-text/editor";
import { Input } from "@/components/ui/form-controls";
import { errorBag, oldInput } from "@/lib/flash";
import { __ } from "@/lib/lang";
import type { findSource } from "./customer";

type Source = Awaited<ReturnType<typeof findSource>>;

/**
 * resources/views/backend/source/store.blade.php + component/aside.blade.php.
 * Ban goc co 2 o name (content + aside, PHP lay o sau); o day chi con 1 o name.
 * Handler doc: name, keyword, description.
 */
export async function SourceStore({ method, source }: { method: "create" | "edit"; source: Source }) {
  const [old, errors] = await Promise.all([oldInput(), errorBag()]);
  const seo = __<Record<string, { title: string }>>("messages.source");
  const url = method === "create" ? "/source/store" : `/source/${source?.id}/update`;
  const v = (name: string, value: unknown) => String(old(name, value ?? "") ?? "");
  const title = method === "create" ? seo.create.title : "Cập nhật nguồn khách";
  return (
    <>
      <PageHeader title={title} crumbs={[{ label: seo.index.title, href: "/source/index" }, { label: title }]} />
      <FormErrors />
      <AdminForm
        action={url}
        cancelHref="/source/index"
        saveMode="single"
        main={
          <Section title="Thông tin nguồn khách">
            <Field label="Mô tả">
              <RichTextEditor name="description" defaultValue={v("description", source?.description)} height={220} compact />
            </Field>
          </Section>
        }
        aside={
          <Section title="Cài đặt cơ bản">
            <Field label="Tên nguồn khách" required error={errors.first("name")}>
              <Input name="name" defaultValue={v("name", source?.name)} autoComplete="off" aria-invalid={errors.has("name")} />
            </Field>
            <Field label="Từ khóa nguồn" required error={errors.first("keyword")} hint="Từ khóa duy nhất để nhận diện nguồn khách.">
              <Input name="keyword" defaultValue={v("keyword", source?.keyword)} autoComplete="off" aria-invalid={errors.has("keyword")} />
            </Field>
          </Section>
        }
      />
    </>
  );
}
