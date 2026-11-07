import { ChevronRightIcon, PencilIcon, PlusIcon, SearchIcon, Trash2Icon, TriangleAlertIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, NativeSelect } from "@/components/ui/form-controls";
import { Alert, Badge } from "@/components/ui/misc";
import { errorBag, oldInput } from "@/lib/flash";
import { image } from "@/lib/helpers";
import { __ } from "@/lib/lang";
import { getCurrentLanguage, getLanguages } from "@/lib/language";
import { cn } from "@/lib/utils";
import { AlbumField, AutoSubmitField, Field, FormSyncProvider, ImageField, SeoFields, TitleInput } from "./fields";
import { RichTextEditor } from "./rich-text/editor";

/**
 * Khoi giao dien dung chung cho trang admin (server components).
 * Moi trang chi ghep cac khoi nay; du lieu va form POST giu nguyen nhu ban Laravel.
 */

type SearchParams = Record<string, string | string[] | undefined>;
const q = (sp: SearchParams, k: string) => {
  const v = sp[k];
  return Array.isArray(v) ? v[0] : v;
};

/* ----------------------------- Tieu de trang ----------------------------- */

export function PageHeader({
  title,
  description,
  crumbs = [],
  actions,
}: {
  title: string;
  description?: React.ReactNode;
  crumbs?: { label: string; href?: string }[];
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <nav className="mb-1 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
          <Link href="/dashboard/index" className="hover:text-foreground">
            Dashboard
          </Link>
          {crumbs.map((c) => (
            <span key={c.label} className="flex items-center gap-1">
              <ChevronRightIcon className="size-3" />
              {c.href ? (
                <Link href={c.href} className="hover:text-foreground">
                  {c.label}
                </Link>
              ) : (
                <span>{c.label}</span>
              )}
            </span>
          ))}
        </nav>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function CreateButton({ href, label }: { href: string; label: string }) {
  return (
    <Button asChild>
      <Link href={href}>
        <PlusIcon /> {label}
      </Link>
    </Button>
  );
}

/* ----------------------------- Trang danh sach ----------------------------- */

/**
 * Thanh loc (perpage.blade.php + filterPublish + keyword): form GET ve chinh trang.
 * `children` la cac bo loc rieng cua module (vd chon danh muc).
 */
export function ListToolbar({
  action,
  searchParams,
  perpage = true,
  publish = true,
  keyword = true,
  children,
}: {
  action: string;
  searchParams: SearchParams;
  perpage?: boolean;
  publish?: boolean;
  keyword?: boolean;
  children?: React.ReactNode;
}) {
  const publishOptions = __<Record<string, string>>("messages.publish");
  return (
    <form action={action} className="flex flex-wrap items-center gap-2 pb-4">
      {perpage && (
        <AutoSubmitField name="perpage" defaultValue={q(searchParams, "perpage") ?? "20"} className="w-36">
          {Array.from({ length: 10 }, (_, i) => (i + 1) * 20).map((n) => (
            <option key={n} value={n}>
              {n} bản ghi
            </option>
          ))}
        </AutoSubmitField>
      )}
      <div className="ml-auto flex flex-wrap items-center gap-2">
        {publish && (
          <AutoSubmitField name="publish" defaultValue={q(searchParams, "publish") || "0"} className="w-44">
            {Object.entries(publishOptions).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </AutoSubmitField>
        )}
        {children}
        {keyword && (
          <div className="relative">
            <SearchIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input name="keyword" defaultValue={q(searchParams, "keyword") ?? ""} placeholder="Nhập từ khóa..." className="w-56 pl-8" />
          </div>
        )}
        <Button type="submit" variant="secondary">
          Tìm kiếm
        </Button>
      </div>
    </form>
  );
}

/** Khung bang danh sach. */
export function ListCard({ title, description, children }: { title?: string; description?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card>
      {title && (
        <CardHeader>
          <div>
            <CardTitle>{title}</CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
          </div>
        </CardHeader>
      )}
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function EmptyRow({ colSpan, text = "Chưa có bản ghi nào." }: { colSpan: number; text?: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="py-12 text-center text-sm text-muted-foreground">
        {text}
      </td>
    </tr>
  );
}

/** Nut Sua / Xoa cuoi dong. */
export function RowActions({ editHref, deleteHref, children }: { editHref?: string; deleteHref?: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-end gap-1">
      {children}
      {editHref && (
        <Button asChild variant="ghost" size="icon-sm" aria-label="Sửa">
          <Link href={editHref}>
            <PencilIcon />
          </Link>
        </Button>
      )}
      {deleteHref && (
        <Button asChild variant="ghost" size="icon-sm" aria-label="Xóa" className="text-destructive hover:bg-destructive/10 hover:text-destructive">
          <Link href={deleteHref}>
            <Trash2Icon />
          </Link>
        </Button>
      )}
    </div>
  );
}

/** Anh nho trong bang. */
export function Thumb({ src, className }: { src: string | null | undefined; className?: string }) {
  return (
    <span className={cn("flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={image(src)} alt="" className="size-full object-cover" loading="lazy" />
    </span>
  );
}

/**
 * Cot "Da dich / Chua dich" cho moi ngon ngu khac ngon ngu dang dung
 * (languageTh + languageTd). Link toi trang dich chung.
 */
export async function TranslateBadges({ id, modeling, translatedIds }: { id: bigint | number | string; modeling: string; translatedIds: Set<string> }) {
  const [languages, current] = await Promise.all([getLanguages(), getCurrentLanguage()]);
  const others = languages.filter((l) => l.canonical !== current.canonical);
  if (!others.length) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {others.map((l) => {
        const done = translatedIds.has(l.id.toString());
        return (
          <Link key={l.id.toString()} href={`/language/${id}/${l.id}/${modeling}/translate`}>
            <Badge variant={done ? "success" : "outline"} className="gap-1.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image(l.image)} alt="" className="size-3 rounded-sm object-cover" />
              {done ? "Đã dịch" : "Chưa dịch"}
            </Badge>
          </Link>
        );
      })}
    </div>
  );
}

/** Cho biet co cot dich hay khong (de an tieu de cot khi chi co 1 ngon ngu). */
export async function hasOtherLanguages() {
  const [languages, current] = await Promise.all([getLanguages(), getCurrentLanguage()]);
  return languages.some((l) => l.canonical !== current.canonical);
}

/* ----------------------------- Trang form ----------------------------- */

/** Loi validate (formError.blade.php) — hien o dau form. */
export async function FormErrors() {
  const errors = await errorBag();
  if (!errors.any()) return null;
  return (
    <Alert variant="destructive" className="mb-5">
      <div className="mb-1 flex items-center gap-2 font-medium">
        <TriangleAlertIcon className="size-4" /> Vui lòng kiểm tra lại thông tin
      </div>
      <ul className="list-disc space-y-0.5 pl-6">
        {errors.all.map((e, i) => (
          <li key={i}>{e}</li>
        ))}
      </ul>
    </Alert>
  );
}

/** Loi cua tung truong (dung trong trang tu viet field). */
export async function fieldErrors() {
  const errors = await errorBag();
  return (name: string) => errors.first(name);
}

/**
 * Khung form store/edit: <form method=post action> + 2 cot + thanh luu dinh day.
 * `autoCanonical`: dang them moi (chua co ten) thi tieu de tu sinh duong dan.
 */
export function AdminForm({
  action,
  main,
  aside,
  cancelHref,
  autoCanonical = false,
  saveMode = "stay-close",
  method,
}: {
  action: string;
  main: React.ReactNode;
  aside?: React.ReactNode;
  cancelHref?: string;
  autoCanonical?: boolean;
  /** "stay-close": 2 nut send_and_stay / send_and_exit (Luu lai / Dong); "single": 1 nut send */
  saveMode?: "stay-close" | "single";
  /** _method (PUT/DELETE) neu can */
  method?: string;
}) {
  return (
    <FormSyncProvider autoCanonical={autoCanonical}>
      <form action={action} method="post" className="pb-20">
        {method && <input type="hidden" name="_method" value={method} />}
        <div className={cn("grid gap-5", aside && "lg:grid-cols-[minmax(0,1fr)_320px]")}>
          <div className="grid min-w-0 content-start gap-5">{main}</div>
          {aside && <div className="grid content-start gap-5">{aside}</div>}
        </div>
        <div className="fixed right-0 bottom-0 left-0 z-20 flex items-center justify-end gap-2 border-t bg-card/95 px-4 py-3 backdrop-blur lg:left-64 lg:px-6">
          {cancelHref && (
            <Button asChild variant="ghost">
              <Link href={cancelHref}>Hủy</Link>
            </Button>
          )}
          {saveMode === "stay-close" ? (
            <>
              <Button type="submit" name="send" value="send_and_exit" variant="outline">
                Lưu & đóng
              </Button>
              <Button type="submit" name="send" value="send_and_stay">
                Lưu lại
              </Button>
            </>
          ) : (
            <Button type="submit" name="send" value="send">
              Lưu lại
            </Button>
          )}
        </div>
      </form>
    </FormSyncProvider>
  );
}

/** Card co tieu de cho mot nhom truong. */
export function Section({ title, description, actions, children, className }: { title: string; description?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <Card className={cn("min-w-0", className)}>
      <CardHeader>
        <div>
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </div>
        {actions}
      </CardHeader>
      <CardContent className="grid min-w-0 gap-4 [&>*]:min-w-0">{children}</CardContent>
    </Card>
  );
}

type SeoModel = {
  name?: string | null;
  description?: string | null;
  content?: string | null;
  meta_title?: string | null;
  meta_keyword?: string | null;
  meta_description?: string | null;
  canonical?: string | null;
} | null;

/** content.blade.php: Tieu de + Mo ta ngan + Noi dung (TipTap). */
export async function ContentSection({ model, offContent, disabled, title = "Thông tin chung" }: { model: SeoModel; offContent?: boolean; disabled?: boolean; title?: string }) {
  const [old, errors] = await Promise.all([oldInput(), errorBag()]);
  return (
    <Section title={title}>
      <Field label="Tiêu đề" required error={errors.first("name")}>
        <TitleInput defaultValue={old("name", model?.name ?? "") ?? ""} disabled={disabled} aria-invalid={errors.has("name")} />
      </Field>
      <Field label="Mô tả ngắn">
        <RichTextEditor name="description" defaultValue={old("description", model?.description ?? "")} height={120} compact disabled={disabled} />
      </Field>
      {!offContent && (
        <Field label="Nội dung">
          <RichTextEditor name="content" defaultValue={old("content", model?.content ?? "")} height={420} disabled={disabled} />
        </Field>
      )}
    </Section>
  );
}

/** seo.blade.php */
export async function SeoSection({ model, disabled }: { model: SeoModel; disabled?: boolean }) {
  const [old, errors] = await Promise.all([oldInput(), errorBag()]);
  return (
    <Section title="Cấu hình SEO" description="Thông tin hiển thị trên kết quả tìm kiếm">
      <SeoFields
        baseUrl={(process.env.APP_URL ?? "/").replace(/\/?$/, "/")}
        disabled={disabled}
        errors={{ canonical: errors.first("canonical") }}
        defaults={{
          meta_title: old("meta_title", model?.meta_title ?? ""),
          meta_keyword: old("meta_keyword", model?.meta_keyword ?? ""),
          meta_description: old("meta_description", model?.meta_description ?? ""),
          canonical: old("canonical", model?.canonical ?? ""),
        }}
      />
    </Section>
  );
}

/** album.blade.php. album: chuoi JSON trong DB hoac mang. */
export async function AlbumSection({ album, title = "Album ảnh" }: { album: string | string[] | null | undefined; title?: string }) {
  const old = await oldInput();
  let saved: string[] = [];
  if (Array.isArray(album)) saved = album;
  else if (album) {
    try {
      const parsed = JSON.parse(album);
      saved = Array.isArray(parsed) ? parsed : Object.values(parsed);
    } catch {
      saved = [];
    }
  }
  const gallery = saved.length ? saved : (old<string[]>("album", []) ?? []);
  return (
    <Section title={title}>
      <AlbumField defaultValue={gallery.map(String)} />
    </Section>
  );
}

/** publish.blade.php: Anh dai dien + Tinh trang (publish) + Dieu huong (follow). */
export async function PublishSection({ model, hideImage = false, children }: { model: { image?: string | null; publish?: number | null; follow?: number | null } | null; hideImage?: boolean; children?: React.ReactNode }) {
  const old = await oldInput();
  const publishOptions = __<Record<string, string>>("messages.publish");
  const followOptions = __<Record<string, string>>("messages.follow");
  return (
    <>
      {!hideImage && (
        <Section title="Ảnh đại diện">
          <ImageField name="image" defaultValue={old("image", model?.image ?? "")} />
        </Section>
      )}
      <Section title="Cấu hình nâng cao">
        <Field label="Tình trạng">
          <NativeSelect name="publish" defaultValue={String(old("publish", model?.publish ?? "2"))}>
            {Object.entries(publishOptions)
              .filter(([k]) => k !== "0")
              .map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
          </NativeSelect>
        </Field>
        <Field label="Điều hướng">
          <NativeSelect name="follow" defaultValue={String(old("follow", model?.follow ?? "1"))}>
            {Object.entries(followOptions).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </NativeSelect>
        </Field>
        {children}
      </Section>
    </>
  );
}

/** delete.blade.php + destroy.blade.php: xac nhan xoa (form DELETE). */
export async function DeleteConfirm({ action, name, title = "Xóa bản ghi", backHref, children }: { action: string; name: string | null | undefined; title?: string; backHref: string; children?: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-xl">
      <FormErrors />
      <form action={action} method="post">
        <input type="hidden" name="_method" value="DELETE" />
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <TriangleAlertIcon className="size-4" /> {title}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <p>
              Bạn đang muốn xóa bản ghi: <b className="text-destructive">{name}</b>
            </p>
            <p className="text-muted-foreground">Lưu ý: không thể khôi phục bản ghi sau khi xóa. Hãy chắc chắn bạn muốn thực hiện chức năng này.</p>
            {children}
          </CardContent>
          <div className="flex justify-end gap-2 border-t px-5 py-3">
            <Button asChild variant="ghost">
              <Link href={backHref}>Quay lại</Link>
            </Button>
            <Button type="submit" variant="destructive" name="send" value="send">
              <Trash2Icon /> Xóa dữ liệu
            </Button>
          </div>
        </Card>
      </form>
    </div>
  );
}
