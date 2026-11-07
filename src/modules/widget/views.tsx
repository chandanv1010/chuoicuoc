import { Field } from "@/components/admin/fields";
import { AdminForm, AlbumSection, ContentSection, DeleteConfirm, FormErrors, PageHeader, Section } from "@/components/admin/page";
import { RichTextEditor } from "@/components/admin/rich-text/editor";
import { Input, Textarea } from "@/components/ui/form-controls";
import { errorBag, oldInput } from "@/lib/flash";
import { __ } from "@/lib/lang";
import { s } from "@/modules/dashboard/ui";
import { WidgetItems } from "./widget-items";

/**
 * resources/views/backend/widget/{store,delete,translate}.blade.php (+ component/aside).
 * Ten truong giu nguyen theo src/modules/widget/routes.ts:
 * name, description, album[], model, modelItem[id|name|image][], keyword, short_code, note.
 */

type WidgetForm = {
  id: bigint;
  name: string;
  keyword: string;
  short_code: string | null;
  note: string | null;
  model: string;
  album: string | null;
  description: string;
} | null;

type Items = { id: string[]; name: string[]; image: string[] };

const crumbsBase = () => ({ label: __<string>("messages.widget.index.title"), href: "/widget/index" });

/** widget/store.blade.php */
export async function WidgetStore({ method, widget, widgetItem }: { method: "create" | "edit"; widget: WidgetForm; widgetItem: Items | null }) {
  const [old, errors] = await Promise.all([oldInput(), errorBag()]);
  const url = method === "create" ? "/widget/store" : `/widget/${widget?.id}/update`;
  const title = method === "create" ? __<string>("messages.widget.create.title") : "Cập nhật widget";
  const models = __<Record<string, string>>("module.model");
  const checkedModel = s(old("model", widget?.model ?? ""));
  const modelItem = old<Items | null>("modelItem", widgetItem);
  const items = (modelItem?.id ?? []).map((id, i) => ({ id: s(id), name: s(modelItem?.name?.[i]), image: s(modelItem?.image?.[i]) }));
  return (
    <>
      <PageHeader title={title} crumbs={[crumbsBase(), { label: title }]} />
      <FormErrors />
      <AdminForm
        action={url}
        saveMode="single"
        cancelHref="/widget/index"
        main={
          <>
            <ContentSection title="Thông tin widget" model={widget ? { name: widget.name, description: widget.description } : null} offContent />
            <AlbumSection album={widget?.album} />
            <Section title="Cấu hình nội dung widget" description="Chọn module rồi tìm và thêm các đối tượng hiển thị trong widget">
              <WidgetItems models={models} defaultModel={checkedModel} defaultItems={items} />
            </Section>
          </>
        }
        aside={
          <>
            <Section title="Cài đặt cơ bản">
              <Field label="Từ khóa widget" required error={errors.first("keyword")} hint="Dùng để gọi widget ngoài giao diện">
                <Input name="keyword" defaultValue={s(old("keyword", widget?.keyword))} autoComplete="off" className="font-mono" aria-invalid={errors.has("keyword")} />
              </Field>
            </Section>
            <Section title="Mã ngắn (short code)">
              <Field error={errors.first("short_code")}>
                <Textarea name="short_code" defaultValue={s(old("short_code", widget?.short_code))} className="min-h-24 font-mono text-xs" aria-invalid={errors.has("short_code")} />
              </Field>
            </Section>
            <Section title="Ghi chú">
              <Textarea name="note" defaultValue={s(old("note", widget?.note))} className="min-h-24" />
            </Section>
          </>
        }
      />
    </>
  );
}

/** widget/delete.blade.php */
export async function WidgetDelete({ widget }: { widget: { id: bigint; name: string } }) {
  return (
    <>
      <PageHeader title="Xóa widget" crumbs={[crumbsBase(), { label: "Xóa" }]} />
      <DeleteConfirm action={`/widget/${widget.id}/destroy`} name={widget.name} title="Xóa widget" backHref="/widget/index" />
    </>
  );
}

/** widget/translate.blade.php — chi dich mo ta (translate_description), POST widget/saveTranslate */
export async function WidgetTranslate({
  translate,
  widget,
  translateDescription,
}: {
  translate: { id: bigint; name: string };
  widget: { id: bigint; name: string; description: string };
  translateDescription: string;
}) {
  const old = await oldInput();
  const title = `${__<string>("messages.widget.create.translate").replace("{language}", translate.name)} ${widget.name}`;
  return (
    <>
      <PageHeader title={title} crumbs={[crumbsBase(), { label: "Dịch" }]} />
      <FormErrors />
      <AdminForm
        action="/widget/saveTranslate"
        saveMode="single"
        cancelHref="/widget/index"
        main={
          <div className="grid gap-5 xl:grid-cols-2">
            <input type="hidden" name="translateId" value={translate.id.toString()} />
            <input type="hidden" name="widgetId" value={widget.id.toString()} />
            <Section title="Bản gốc">
              <Field label="Tên widget">
                <Input value={widget.name} disabled readOnly />
              </Field>
              <Field label="Mô tả">
                {widget.description ? (
                  <div className="max-h-96 overflow-auto rounded-md border bg-muted/30 px-3 py-2 text-sm" dangerouslySetInnerHTML={{ __html: widget.description }} />
                ) : (
                  <div className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">Trống</div>
                )}
              </Field>
            </Section>
            <Section title={`Bản dịch — ${translate.name}`}>
              <Field label="Mô tả">
                <RichTextEditor name="translate_description" defaultValue={old("translate_description", translateDescription)} height={200} compact />
              </Field>
            </Section>
          </div>
        }
      />
    </>
  );
}
