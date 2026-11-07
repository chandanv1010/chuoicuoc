import { Field, ImageField } from "@/components/admin/fields";
import { AdminForm, DeleteConfirm, FormErrors, PageHeader, Section } from "@/components/admin/page";
import { RichTextEditor } from "@/components/admin/rich-text/editor";
import { Input } from "@/components/ui/form-controls";
import { errorBag, oldInput } from "@/lib/flash";
import { __ } from "@/lib/lang";
import { s } from "@/modules/dashboard/ui";
import type { findLecturer } from "./service";

type Lecturer = Awaited<ReturnType<typeof findLecturer>>;

/** resources/views/backend/lecturer/store.blade.php — name, position, description, image */
export async function LecturerStore({ method, lecturer }: { method: "create" | "edit"; lecturer: Lecturer }) {
  const [old, errors] = await Promise.all([oldInput(), errorBag()]);
  const url = method === "create" ? "/lecturer/store" : `/lecturer/${lecturer?.id}/update`;
  const index = __<string>("messages.lecturer.index.title");
  const title = method === "create" ? __<string>("messages.lecturer.create.title") : "Cập nhật giảng viên";
  return (
    <>
      <PageHeader title={title} crumbs={[{ label: index, href: "/lecturer/index" }, { label: title }]} />
      <FormErrors />
      <AdminForm
        action={url}
        saveMode="single"
        cancelHref="/lecturer/index"
        main={
          <Section title="Thông tin giảng viên">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Họ tên" required error={errors.first("name")}>
                <Input name="name" defaultValue={s(old("name", lecturer?.name))} autoComplete="off" />
              </Field>
              <Field label="Chức vụ" required error={errors.first("position")}>
                <Input name="position" defaultValue={s(old("position", lecturer?.position))} autoComplete="off" />
              </Field>
            </div>
            <Field label="Mô tả">
              <RichTextEditor name="description" defaultValue={old("description", lecturer?.description ?? "")} height={200} />
            </Field>
          </Section>
        }
        aside={
          <Section title="Ảnh đại diện">
            <ImageField name="image" defaultValue={s(old("image", lecturer?.image))} aspect="aspect-square" />
          </Section>
        }
      />
    </>
  );
}

/** resources/views/backend/lecturer/delete.blade.php */
export async function LecturerDelete({ lecturer }: { lecturer: NonNullable<Lecturer> }) {
  const index = __<string>("messages.lecturer.index.title");
  return (
    <>
      <PageHeader title="Xóa giảng viên" crumbs={[{ label: index, href: "/lecturer/index" }, { label: "Xóa" }]} />
      <DeleteConfirm action={`/lecturer/${lecturer.id}/destroy`} name={lecturer.name} title="Xóa giảng viên" backHref="/lecturer/index" />
    </>
  );
}
