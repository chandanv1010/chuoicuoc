import { Field, ImageField } from "@/components/admin/fields";
import { AdminForm, FormErrors, PageHeader, Section } from "@/components/admin/page";
import { Combobox } from "@/components/ui/combobox";
import { Input, NativeSelect, Textarea } from "@/components/ui/form-controls";
import { errorBag, oldInput } from "@/lib/flash";
import { __ } from "@/lib/lang";
import { e } from "@/modules/slide/php";
import { NHOM, type FeatureRow } from "./home-feature";

/** resources/views/backend/home_feature/store.blade.php — POST home-feature/store | {id}/update */
export async function FeatureStore({ method, feature, baiViet }: { method: "create" | "edit"; feature: FeatureRow | null; baiViet: [string, string][] }) {
  const [old, errors] = await Promise.all([oldInput(), errorBag()]);
  const seo = __<Record<string, { title: string }>>("messages.homeFeature");
  const url = method === "create" ? "/home-feature/store" : `/home-feature/${feature?.id}/update`;
  const group = e(old("group", feature?.group ?? ""));
  const postId = Number.parseInt(e(old("post_id", feature?.post_id ?? 0)), 10) || 0;
  const publish = e(old("publish", feature?.publish ?? 2));
  const title = seo[method].title;

  return (
    <>
      <PageHeader title={title} crumbs={[{ label: seo.index.title, href: "/home-feature/index" }, { label: title }]} />
      <FormErrors />
      <AdminForm
        action={url}
        cancelHref="/home-feature/index"
        saveMode="single"
        main={
          <Section title="Nội dung mục">
            <Field label="Khối hiển thị" required error={errors.first("group")} hint="Chọn đúng khối thì mục mới hiện ra ở vị trí mong muốn trên trang chủ.">
              <NativeSelect name="group" defaultValue={group in NHOM ? group : Object.keys(NHOM)[0]}>
                {Object.entries(NHOM).map(([ma, ten]) => (
                  <option key={ma} value={ma}>
                    {ten}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Tiêu đề" required error={errors.first("title")} hint="Nhấn Enter để xuống dòng. Chỗ xuống dòng sẽ hiện đúng như vậy ngoài trang.">
              <Textarea name="title" rows={2} className="min-h-16" defaultValue={e(old("title", feature?.title ?? ""))} aria-invalid={errors.has("title")} />
            </Field>
            <Field label="Mô tả ngắn" error={errors.first("description")} hint="Dòng chữ nhỏ dưới tiêu đề. Khối “Vì sao chọn WACO” dùng ô này, các khối khác có thể để trống.">
              <Input name="description" defaultValue={e(old("description", feature?.description ?? ""))} autoComplete="off" />
            </Field>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Con số" error={errors.first("value")} hint="Chỉ dùng cho khối “Dải cam kết” và “Số liệu mạng lưới”.">
                <Input name="value" defaultValue={e(old("value", feature?.value ?? ""))} placeholder="Ví dụ: 63, 1.000+, 24/7" autoComplete="off" />
              </Field>
              <Field label="Thứ tự" error={errors.first("order")} hint="Số nhỏ đứng trước. Các mục trong cùng một khối xếp theo số này.">
                <Input type="number" name="order" min={0} defaultValue={e(old("order", feature?.order ?? 0))} />
              </Field>
            </div>
            <Field
              label="Bài viết mở ra khi bấm"
              error={errors.first("post_id")}
              hint="Dùng cho khối “Huy hiệu khối giới thiệu”: bấm vào huy hiệu sẽ mở bài viết này; ảnh album của bài viết hiện thành lưới 3 ảnh một hàng."
            >
              <Combobox
                name="post_id"
                defaultValue={baiViet.some(([id]) => Number(id) === postId) ? String(postId) : ""}
                options={[{ value: "", label: "— Không liên kết, chỉ hiện icon —" }, ...baiViet.map(([value, label]) => ({ value, label }))]}
                searchPlaceholder="Tìm bài viết..."
              />
            </Field>
          </Section>
        }
        aside={
          <>
            <Section title="Icon" description="Nên dùng ảnh PNG nền trong suốt.">
              <ImageField name="icon" defaultValue={e(old("icon", feature?.icon ?? ""))} aspect="aspect-square" />
            </Section>
            <Section title="Trạng thái">
              <Field label="Trạng thái hiển thị">
                <NativeSelect name="publish" defaultValue={publish === "1" ? "1" : "2"}>
                  <option value="2">Hiển thị</option>
                  <option value="1">Ẩn</option>
                </NativeSelect>
              </Field>
            </Section>
          </>
        }
      />
    </>
  );
}
