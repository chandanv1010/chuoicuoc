"use client";

import { useState } from "react";
import { Field } from "@/components/admin/fields";
import { Input, Textarea } from "@/components/ui/form-controls";
import { slugify } from "@/lib/slug";
import { cn } from "@/lib/utils";

/**
 * O tieu de ban dich + khoi SEO ban dich (translate.blade.php + seoTranslate.blade.php).
 * Ten truong co tien to translate_ nhu handler POST language/storeTranslate doc.
 * Chua co duong dan ban dich thi go tieu de se tu sinh duong dan (Str::slug).
 */
export function TranslateTitle({ defaultValue, error, onTitle }: { defaultValue: string; error?: string; onTitle?: (v: string) => void }) {
  return (
    <Field label="Tiêu đề" required error={error}>
      <Input name="translate_name" defaultValue={defaultValue} autoComplete="off" aria-invalid={Boolean(error)} onChange={(e) => onTitle?.(e.target.value)} />
    </Field>
  );
}

export function TranslateHeadAndSeo({
  baseUrl,
  defaults,
  errors,
  children,
}: {
  baseUrl: string;
  defaults: { name: string; meta_title: string; meta_keyword: string; meta_description: string; canonical: string };
  errors: { name?: string; canonical?: string };
  /** cac o mo ta / noi dung chen giua tieu de va SEO */
  children?: React.ReactNode;
}) {
  const [title, setTitle] = useState(defaults.name);
  const [metaTitle, setMetaTitle] = useState(defaults.meta_title);
  const [metaDesc, setMetaDesc] = useState(defaults.meta_description);
  const [canonical, setCanonical] = useState(defaults.canonical);
  const [touched, setTouched] = useState(Boolean(defaults.canonical));
  const shown = touched ? canonical : slugify(title);

  return (
    <>
      <div className="grid gap-4 rounded-xl border bg-card p-5 shadow-xs">
        <div className="text-sm font-semibold">Bản dịch</div>
        <TranslateTitle defaultValue={defaults.name} error={errors.name} onTitle={setTitle} />
        {children}
      </div>
      <div className="grid min-w-0 gap-4 rounded-xl [&>*]:min-w-0 border bg-card p-5 shadow-xs">
        <div className="text-sm font-semibold">Cấu hình SEO (bản dịch)</div>
        <div className="rounded-lg border bg-muted/30 p-4">
          <div className="truncate text-lg text-[#1a0dab]">{metaTitle || title || "Bạn chưa có tiêu đề SEO"}</div>
          <div className="truncate text-sm text-[#006621]">{shown ? `${baseUrl}${shown}.html` : "https://duong-dan-cua-ban.html"}</div>
          <div className="line-clamp-2 text-sm text-muted-foreground">{metaDesc || "Mô tả SEO sẽ hiển thị ở đây"}</div>
        </div>
        <Field label="Tiêu đề SEO" aside={<span className="text-xs text-muted-foreground">{metaTitle.length} ký tự</span>}>
          <Input name="translate_meta_title" value={metaTitle} onChange={(e) => setMetaTitle(e.target.value)} autoComplete="off" />
        </Field>
        <Field label="Từ khóa SEO">
          <Input name="translate_meta_keyword" defaultValue={defaults.meta_keyword} autoComplete="off" />
        </Field>
        <Field label="Mô tả SEO" aside={<span className={cn("text-xs", metaDesc.length > 160 ? "text-destructive" : "text-muted-foreground")}>{metaDesc.length} / 160 ký tự</span>}>
          <Textarea name="translate_meta_description" value={metaDesc} onChange={(e) => setMetaDesc(e.target.value)} />
        </Field>
        <Field label="Đường dẫn (không bao gồm đuôi .html)" required error={errors.canonical}>
          <div className="flex items-stretch overflow-hidden rounded-md border border-input bg-card shadow-xs focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50">
            <span className="flex items-center border-r bg-muted px-3 text-xs whitespace-nowrap text-muted-foreground">{baseUrl}</span>
            <input
              name="translate_canonical"
              value={shown}
              onChange={(e) => {
                setTouched(true);
                setCanonical(e.target.value);
              }}
              autoComplete="off"
              aria-invalid={Boolean(errors.canonical)}
              className="h-9 min-w-0 flex-1 bg-transparent px-3 text-sm outline-none"
            />
          </div>
        </Field>
      </div>
    </>
  );
}
