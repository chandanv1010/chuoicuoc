import { Field } from "@/components/admin/fields";
import { AdminForm, FormErrors, PageHeader, Section } from "@/components/admin/page";
import { Input, NativeSelect, Textarea } from "@/components/ui/form-controls";
import { errorBag, getFlash, oldInput } from "@/lib/flash";
import { __ } from "@/lib/lang";
import { e } from "./php";
import { SlideItemsEditor, type SlideItemValue } from "./slide-items";
import type { SlideRow } from "./slide";

/**
 * resources/views/backend/slide/store.blade.php (+ component/list.blade.php, component/aside.blade.php).
 * Form POST slide/store | slide/{id}/update, giu ten truong slide[...] va setting[...].
 */
export async function SlideStore({ method, slide, slideItem }: { method: "create" | "edit"; slide: SlideRow | null; slideItem: Record<string, unknown[]> | null }) {
  const [old, errors, flash] = await Promise.all([oldInput(), errorBag(), getFlash()]);
  const seo = __<Record<string, { title: string }>>("messages.slide");
  const url = method === "create" ? "/slide/store" : `/slide/${slide?.id}/update`;
  const items = toItems(old<Record<string, unknown> | null>("slide", slideItem ?? null));

  // aside.blade.php luon tick arrow/autoplay/pauseHover va chon 'dots' khi khong co old() (ke ca luc sua -> moi lan luu
  // deu ghi de cau hinh da luu). Giao dien moi: them moi thi mac dinh nhu cu, sua thi hien dung cau hinh da luu.
  const hasOld = !!flash.old;
  const setting = (slide?.setting && typeof slide.setting === "object" && !Array.isArray(slide.setting) ? slide.setting : null) as Record<string, unknown> | null;
  const s = (k: string) => e(old(`setting.${k}`, setting?.[k] ?? null));
  const effects = __<Record<string, string>>("module.effect");
  const navigates = __<Record<string, string>>("module.navigate");
  const animation = s("animation");
  const useSaved = hasOld || setting !== null;
  const navigate = useSaved ? s("navigate") || (hasOld ? "" : "dots") : "dots";
  const checked = (k: string) => !useSaved || s(k) === "accept";
  const title = method === "create" ? seo.create.title : "Cập nhật slide";

  return (
    <>
      <PageHeader title={title} crumbs={[{ label: seo.index.title, href: "/slide/index" }, { label: title }]} />
      <FormErrors />
      <AdminForm
        action={url}
        cancelHref="/slide/index"
        saveMode="single"
        main={
          <Section title="Danh sách slide" description="Mỗi ảnh có tiêu đề, mô tả, liên kết riêng. Ảnh đứng trước hiển thị trước.">
            <SlideItemsEditor defaultValue={items} error={errors.first("slide.image")} />
          </Section>
        }
        aside={
          <>
            <Section title="Cài đặt cơ bản">
              <Field label="Tên slide" required error={errors.first("name")}>
                <Input name="name" defaultValue={e(old("name", slide?.name ?? ""))} autoComplete="off" aria-invalid={errors.has("name")} />
              </Field>
              <Field label="Từ khóa slide" required error={errors.first("keyword")} hint="Dùng để gọi slide ngoài trang (vd main-slide).">
                <Input name="keyword" defaultValue={e(old("keyword", slide?.keyword ?? ""))} autoComplete="off" aria-invalid={errors.has("keyword")} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Chiều rộng">
                  <UnitInput name="setting[width]" defaultValue={s("width")} unit="px" />
                </Field>
                <Field label="Chiều cao">
                  <UnitInput name="setting[height]" defaultValue={s("height")} unit="px" />
                </Field>
              </div>
              <Field label="Hiệu ứng">
                <NativeSelect name="setting[animation]" defaultValue={animation in effects ? animation : undefined}>
                  {Object.entries(effects).map(([key, val]) => (
                    <option key={key} value={key}>
                      {val}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <CheckRow name="setting[arrow]" label="Hiện mũi tên" defaultChecked={checked("arrow")} />
              <Field label="Điều hướng">
                <div className="flex flex-wrap gap-x-4 gap-y-2">
                  {Object.entries(navigates).map(([key, val]) => (
                    <label key={key} className="flex items-center gap-2 text-sm">
                      <input type="radio" className="size-4 accent-primary" name="setting[navigate]" value={key} defaultChecked={navigate === key} />
                      {val}
                    </label>
                  ))}
                </div>
              </Field>
            </Section>
            <Section title="Cài đặt nâng cao">
              <CheckRow name="setting[autoplay]" label="Tự động chạy" defaultChecked={checked("autoplay")} />
              <CheckRow name="setting[pauseHover]" label="Dừng khi di chuột" defaultChecked={checked("pauseHover")} />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Chuyển ảnh">
                  <UnitInput name="setting[animationDelay]" defaultValue={s("animationDelay")} unit="ms" />
                </Field>
                <Field label="Tốc độ hiệu ứng">
                  <UnitInput name="setting[animationSpeed]" defaultValue={s("animationSpeed")} unit="ms" />
                </Field>
              </div>
            </Section>
            <Section title="Short code">
              <Textarea name="short_code" defaultValue={e(old("short_code", slide?.short_code ?? null))} className="font-mono text-xs" />
            </Section>
          </>
        }
      />
    </>
  );
}

function UnitInput({ name, defaultValue, unit }: { name: string; defaultValue: string; unit: string }) {
  return (
    <div className="relative">
      <Input name={name} defaultValue={defaultValue} inputMode="numeric" className="pr-9 text-right" autoComplete="off" />
      <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-muted-foreground">{unit}</span>
    </div>
  );
}

function CheckRow({ name, label, defaultChecked }: { name: string; label: string; defaultChecked: boolean }) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
      {label}
      <input type="checkbox" className="size-4 accent-primary" name={name} value="accept" defaultChecked={defaultChecked} />
    </label>
  );
}

/** {image:[], name:[], ...} (DB qua converSlideArray hoac old input co chi so) -> danh sach anh */
function toItems(slides: Record<string, unknown> | null): SlideItemValue[] {
  if (!slides || typeof slides !== "object") return [];
  const col = (k: string) => {
    const v = slides[k];
    return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  };
  const images = col("image");
  return Object.keys(images).map((k) => ({
    image: e(images[k]),
    name: e(col("name")[k]),
    description: e(col("description")[k]),
    canonical: e(col("canonical")[k]),
    alt: e(col("alt")[k]),
    window: e(col("window")[k]),
  }));
}
