import { LanguagesIcon } from "lucide-react";
import { Field, ImageField } from "@/components/admin/fields";
import { AdminForm, DeleteConfirm, FormErrors, PageHeader, Section } from "@/components/admin/page";
import { RichTextEditor } from "@/components/admin/rich-text/editor";
import { Input } from "@/components/ui/form-controls";
import { Badge } from "@/components/ui/misc";
import { errorBag, oldInput } from "@/lib/flash";
import { __ } from "@/lib/lang";
import { s } from "@/modules/dashboard/ui";
import type { findLanguage, TranslateObject } from "./service";
import { TranslateHeadAndSeo } from "./translate-fields";

type Language = Awaited<ReturnType<typeof findLanguage>>;

const crumbsBase = { label: "Ngôn ngữ", href: "/language/index" };

/** resources/views/backend/language/store.blade.php — name, canonical, image (description khong co cot) */
export async function LanguageStore({ method, language }: { method: "create" | "edit"; language: Language }) {
  const [old, errors] = await Promise.all([oldInput(), errorBag()]);
  const url = method === "create" ? "/language/store" : `/language/${language?.id}/update`;
  const title = __<string>(`messages.language.${method}.title`);
  return (
    <>
      <PageHeader title={title} crumbs={[crumbsBase, { label: title }]} />
      <FormErrors />
      <AdminForm
        action={url}
        saveMode="single"
        cancelHref="/language/index"
        main={
          <Section title="Thông tin chung" description="Nhập thông tin chung của ngôn ngữ. Những trường đánh dấu * là bắt buộc.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Tên ngôn ngữ" required error={errors.first("name")}>
                <Input name="name" defaultValue={s(old("name", language?.name))} autoComplete="off" aria-invalid={errors.has("name")} />
              </Field>
              <Field label="Canonical" required error={errors.first("canonical")} hint="Mã ngôn ngữ, ví dụ: vn, en">
                <Input name="canonical" defaultValue={s(old("canonical", language?.canonical))} autoComplete="off" className="font-mono" aria-invalid={errors.has("canonical")} />
              </Field>
            </div>
            <Field label="Ghi chú">
              <Input name="description" defaultValue={s(old("description", ""))} autoComplete="off" />
            </Field>
          </Section>
        }
        aside={
          <Section title="Cờ / ảnh đại diện">
            <ImageField name="image" defaultValue={s(old("image", language?.image))} aspect="aspect-[3/2]" />
          </Section>
        }
      />
    </>
  );
}

/** resources/views/backend/language/delete.blade.php */
export async function LanguageDelete({ language }: { language: NonNullable<Language> }) {
  return (
    <>
      <PageHeader title={__<string>("messages.language.delete.title")} crumbs={[crumbsBase, { label: "Xóa" }]} />
      <DeleteConfirm action={`/language/${language.id}/destroy`} name={`${language.name} (${language.canonical})`} title="Xóa ngôn ngữ" backHref="/language/index" />
    </>
  );
}

/** Khoi chi doc cua ban goc. */
function ReadOnly({ label, html, text }: { label: string; html?: string | null; text?: string | null }) {
  return (
    <div className="grid gap-1.5">
      <div className="text-sm font-medium">{label}</div>
      {html !== undefined ? (
        html ? (
          <div className="prose prose-sm max-h-96 max-w-none overflow-auto rounded-md border bg-muted/30 px-3 py-2 text-sm" dangerouslySetInnerHTML={{ __html: html }} />
        ) : (
          <div className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">Trống</div>
        )
      ) : (
        <div className="min-h-9 rounded-md border bg-muted/30 px-3 py-2 text-sm break-words">{text || <span className="text-muted-foreground">Trống</span>}</div>
      )}
    </div>
  );
}

/**
 * resources/views/backend/language/translate.blade.php (+ translate.blade.php, seoTranslate.blade.php):
 * trai = ban goc (ngon ngu dang dung, chi doc), phai = ban dich. POST language/storeTranslate.
 */
export async function LanguageTranslate({
  option,
  object,
  objectTranslate,
  modelLabel,
  target,
  current,
}: {
  option: { id: string; languageId: string; model: string };
  object: TranslateObject;
  objectTranslate: TranslateObject;
  modelLabel: string;
  target: { name: string; image: string | null } | null;
  current: { name: string };
}) {
  const [old, errors] = await Promise.all([oldInput(), errorBag()]);
  const baseUrl = (process.env.APP_URL ?? "/").replace(/\/?$/, "/");
  const title = `Dịch ${modelLabel.toLowerCase()} sang ${target?.name ?? "ngôn ngữ khác"}`;
  const o = (k: string, v: string | null | undefined) => s(old(`translate_${k}`, v ?? ""));
  return (
    <>
      <PageHeader
        title={title}
        description={object?.name ? <>Bản gốc: <b>{object.name}</b></> : "Bản ghi chưa có nội dung ở ngôn ngữ hiện tại"}
        crumbs={[crumbsBase, { label: "Dịch nội dung" }]}
      />
      <FormErrors />
      <AdminForm
        action="/language/storeTranslate"
        saveMode="single"
        main={
          <div className="grid gap-5 xl:grid-cols-2">
            <input type="hidden" name="option[id]" value={option.id} />
            <input type="hidden" name="option[languageId]" value={option.languageId} />
            <input type="hidden" name="option[model]" value={option.model} />
            <div className="grid content-start gap-5">
              <Section
                title="Bản gốc"
                actions={
                  <Badge variant="secondary">
                    <LanguagesIcon /> {current.name}
                  </Badge>
                }
              >
                <ReadOnly label="Tiêu đề" text={object?.name} />
                <ReadOnly label="Mô tả ngắn" html={object?.description} />
                <ReadOnly label="Nội dung" html={object?.content} />
              </Section>
              <Section title="SEO bản gốc">
                <ReadOnly label="Tiêu đề SEO" text={object?.meta_title} />
                <ReadOnly label="Từ khóa SEO" text={object?.meta_keyword} />
                <ReadOnly label="Mô tả SEO" text={object?.meta_description} />
                <ReadOnly label="Đường dẫn" text={object?.canonical ? `${baseUrl}${object.canonical}.html` : ""} />
              </Section>
            </div>
            <div className="grid content-start gap-5">
              <TranslateHeadAndSeo
                baseUrl={baseUrl}
                errors={{ name: errors.first("translate_name"), canonical: errors.first("translate_canonical") }}
                defaults={{
                  name: o("name", objectTranslate?.name),
                  meta_title: o("meta_title", objectTranslate?.meta_title),
                  meta_keyword: o("meta_keyword", objectTranslate?.meta_keyword),
                  meta_description: o("meta_description", objectTranslate?.meta_description),
                  canonical: o("canonical", objectTranslate?.canonical),
                }}
              >
                <Field label="Mô tả ngắn">
                  <RichTextEditor name="translate_description" defaultValue={old("translate_description", objectTranslate?.description ?? "")} height={120} compact />
                </Field>
                <Field label="Nội dung">
                  <RichTextEditor name="translate_content" defaultValue={old("translate_content", objectTranslate?.content ?? "")} height={420} />
                </Field>
              </TranslateHeadAndSeo>
            </div>
          </div>
        }
      />
    </>
  );
}
