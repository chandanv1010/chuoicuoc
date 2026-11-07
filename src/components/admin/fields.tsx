"use client";

import { closestCenter, DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, rectSortingStrategy, SortableContext, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVerticalIcon, ImageIcon, ImagePlusIcon, Loader2Icon, Trash2Icon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { createContext, useContext, useId, useMemo, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, NativeSelect, Textarea } from "@/components/ui/form-controls";
import { Checkbox, Switch } from "@/components/ui/interactive";
import { toast } from "@/components/ui/sonner";
import { slugify } from "@/lib/slug";
import { cn } from "@/lib/utils";
import { MediaPicker, type MediaType } from "./media-picker";

/* ------------------------------------------------------------------ */
/* Truong form co nhan + loi                                           */
/* ------------------------------------------------------------------ */

export function Field({
  label,
  htmlFor,
  required,
  error,
  hint,
  className,
  children,
  aside,
}: {
  label?: React.ReactNode;
  htmlFor?: string;
  required?: boolean;
  error?: string;
  hint?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <div className={cn("grid min-w-0 gap-1.5 [&>*]:min-w-0", className)}>
      {(label || aside) && (
        <div className="flex items-center justify-between gap-2">
          {label && (
            <Label htmlFor={htmlFor}>
              {label}
              {required && <span className="text-destructive">*</span>}
            </Label>
          )}
          {aside}
        </div>
      )}
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Dong bo Tieu de -> Duong dan (thay seo.js: .change-title -> .seo-canonical) */
/* ------------------------------------------------------------------ */

type SyncCtx = { title: string; setTitle: (v: string) => void; autoCanonical: boolean };
const FormSync = createContext<SyncCtx | null>(null);

/** Boc form store: khi them moi (chua co ten) thi go tieu de se tu sinh duong dan. */
export function FormSyncProvider({ autoCanonical, initialTitle = "", children }: { autoCanonical: boolean; initialTitle?: string; children: React.ReactNode }) {
  const [title, setTitle] = useState(initialTitle);
  const value = useMemo(() => ({ title, setTitle, autoCanonical }), [title, autoCanonical]);
  return <FormSync.Provider value={value}>{children}</FormSync.Provider>;
}

/** O "Tieu de" — phat tieu de cho SeoFields de tu sinh canonical. */
export function TitleInput({ name = "name", defaultValue, ...props }: React.ComponentProps<typeof Input>) {
  const sync = useContext(FormSync);
  return (
    <Input
      name={name}
      defaultValue={defaultValue}
      autoComplete="off"
      onChange={(e) => sync?.setTitle(e.target.value)}
      {...props}
    />
  );
}

/** Khoi SEO (seo.blade.php + seo.js): xem truoc kieu Google, dem ky tu, duong dan tu sinh. */
export function SeoFields({
  baseUrl,
  suffix = ".html",
  defaults,
  errors = {},
  disabled,
}: {
  baseUrl: string;
  suffix?: string;
  defaults: { meta_title?: string | null; meta_keyword?: string | null; meta_description?: string | null; canonical?: string | null };
  errors?: Record<string, string | undefined>;
  disabled?: boolean;
}) {
  const sync = useContext(FormSync);
  const [metaTitle, setMetaTitle] = useState(defaults.meta_title ?? "");
  const [metaDesc, setMetaDesc] = useState(defaults.meta_description ?? "");
  const [canonical, setCanonical] = useState(defaults.canonical ?? "");
  const [touched, setTouched] = useState(Boolean(defaults.canonical));
  const shown = sync?.autoCanonical && !touched ? slugify(sync.title) : canonical;
  const previewTitle = metaTitle || sync?.title || "Bạn chưa có tiêu đề SEO";

  return (
    <div className="grid min-w-0 gap-4 [&>*]:min-w-0">
      <div className="rounded-lg border bg-muted/30 p-4">
        <div className="truncate text-lg text-[#1a0dab]">{previewTitle}</div>
        <div className="truncate text-sm text-[#006621]">{shown ? `${baseUrl}${shown}${suffix}` : "https://duong-dan-cua-ban.html"}</div>
        <div className="line-clamp-2 text-sm text-muted-foreground">{metaDesc || "Mô tả SEO sẽ hiển thị ở đây"}</div>
      </div>
      <Field label="Tiêu đề SEO" aside={<span className="text-xs text-muted-foreground">{metaTitle.length} ký tự</span>}>
        <Input name="meta_title" value={metaTitle} onChange={(e) => setMetaTitle(e.target.value)} disabled={disabled} autoComplete="off" />
      </Field>
      <Field label="Từ khóa SEO">
        <Input name="meta_keyword" defaultValue={defaults.meta_keyword ?? ""} disabled={disabled} autoComplete="off" />
      </Field>
      <Field
        label="Mô tả SEO"
        aside={<span className={cn("text-xs", metaDesc.length > 160 ? "text-destructive" : "text-muted-foreground")}>{metaDesc.length} / 160 ký tự</span>}
      >
        <Textarea
          name="meta_description"
          value={metaDesc}
          onChange={(e) => setMetaDesc(e.target.value)}
          disabled={disabled}
          className={cn(metaDesc.length > 160 && "border-destructive")}
        />
      </Field>
      <Field label="Đường dẫn (không bao gồm đuôi .html)" required error={errors.canonical}>
        <div className="flex items-stretch overflow-hidden rounded-md border border-input bg-card shadow-xs focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50">
          <span title={baseUrl} className="hidden max-w-[45%] shrink-0 items-center truncate border-r bg-muted px-3 text-xs leading-9 whitespace-nowrap text-muted-foreground sm:block">
            {baseUrl}
          </span>
          <input
            name="canonical"
            value={shown}
            onChange={(e) => {
              setTouched(true);
              setCanonical(e.target.value);
            }}
            disabled={disabled}
            autoComplete="off"
            aria-invalid={Boolean(errors.canonical)}
            className="h-9 min-w-0 flex-1 bg-transparent px-3 text-sm outline-none"
          />
        </div>
      </Field>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Anh dai dien / Album / File                                        */
/* ------------------------------------------------------------------ */

/** O chon 1 anh (thay .image-target + input hidden). */
export function ImageField({ name, defaultValue, className, aspect = "aspect-[4/3]" }: { name: string; defaultValue?: string | null; className?: string; aspect?: string }) {
  const [value, setValue] = useState(defaultValue ?? "");
  const [open, setOpen] = useState(false);
  return (
    // grid-cols-1 = minmax(0,1fr): cot auto bi noi dung (duong dan anh dai) day rong hon khung -> anh 4:3 cao vong len
    <div className={cn("grid grid-cols-1 gap-2", className)}>
      <input type="hidden" name={name} value={value} />
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "group relative flex w-full min-w-0 items-center justify-center overflow-hidden rounded-lg border border-dashed bg-muted/30 transition-colors hover:border-primary hover:bg-primary/5",
          aspect,
        )}
      >
        {value ? (
          // absolute: anh doc (cao) khong day khung aspect-ratio dai ra (min-height:auto cua khung tinh theo noi dung)
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="absolute inset-0 size-full object-contain" />
        ) : (
          <span className="flex flex-col items-center gap-1 text-xs text-muted-foreground">
            <ImagePlusIcon className="size-7" />
            Bấm để chọn ảnh
          </span>
        )}
      </button>
      {value && (
        <div className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground" title={value}>
            {value}
          </span>
          <Button type="button" variant="ghost" size="icon-sm" onClick={() => setValue("")} aria-label="Bỏ ảnh">
            <XIcon />
          </Button>
        </div>
      )}
      <MediaPicker open={open} onOpenChange={setOpen} onSelect={(urls) => setValue(urls[0])} />
    </div>
  );
}

/** O nhap duong dan file/anh co nut chon tu thu vien (thay input.upload-image, .upload-video). */
export function FileUrlInput({ name, defaultValue, type = "Images", placeholder }: { name: string; defaultValue?: string | null; type?: MediaType; placeholder?: string }) {
  const [value, setValue] = useState(defaultValue ?? "");
  const [open, setOpen] = useState(false);
  return (
    <div className="flex gap-2">
      <Input name={name} value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} autoComplete="off" />
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        <ImageIcon /> Chọn
      </Button>
      <MediaPicker open={open} type={type} onOpenChange={setOpen} onSelect={(urls) => setValue(urls[0])} />
    </div>
  );
}

function SortableThumb({ id, url, onRemove, name }: { id: string; url: string; onRemove: () => void; name: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("group relative aspect-square overflow-hidden rounded-lg border bg-muted/30", isDragging && "z-10 opacity-80 shadow-lg")}
    >
      <input type="hidden" name={name} value={url} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="" className="size-full object-cover" loading="lazy" />
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="absolute top-1 left-1 flex size-6 cursor-grab items-center justify-center rounded bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100"
        aria-label="Kéo để sắp xếp"
      >
        <GripVerticalIcon className="size-3.5" />
      </button>
      <button
        type="button"
        onClick={onRemove}
        className="absolute top-1 right-1 flex size-6 items-center justify-center rounded bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-destructive"
        aria-label="Xóa ảnh"
      >
        <Trash2Icon className="size-3.5" />
      </button>
    </div>
  );
}

/** Album anh (album.blade.php): them nhieu anh, keo tha sap xep, gui album[]. */
export function AlbumField({ name = "album[]", defaultValue = [] }: { name?: string; defaultValue?: string[] }) {
  const counter = useRef(0);
  const [items, setItems] = useState(() => defaultValue.map((url) => ({ id: `a${counter.current++}`, url })));
  const [open, setOpen] = useState(false);
  // id on dinh giua server/client, tranh lech aria-describedby khi hydrate
  const dndId = useId();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    setItems((list) => arrayMove(list, list.findIndex((i) => i.id === e.active.id), list.findIndex((i) => i.id === e.over!.id)));
  };
  return (
    <div className="grid gap-3">
      {items.length === 0 ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/30 py-10 text-sm text-muted-foreground transition-colors hover:border-primary hover:bg-primary/5"
        >
          <ImagePlusIcon className="size-8" />
          Sử dụng nút “Chọn ảnh” hoặc bấm vào đây để thêm hình ảnh
        </button>
      ) : (
        <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={items.map((i) => i.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-3">
              {items.map((item) => (
                <SortableThumb key={item.id} id={item.id} url={item.url} name={name} onRemove={() => setItems((l) => l.filter((x) => x.id !== item.id))} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
      <div>
        <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
          <ImagePlusIcon /> Chọn ảnh
        </Button>
      </div>
      <MediaPicker
        open={open}
        multiple
        onOpenChange={setOpen}
        onSelect={(urls) => setItems((l) => [...l, ...urls.map((url) => ({ id: `a${counter.current++}`, url }))])}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Bang danh sach: trang thai, thu tu, chon nhieu dong                */
/* ------------------------------------------------------------------ */

async function postForm(url: string, data: Record<string, string | string[]>) {
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(data)) {
    if (Array.isArray(v)) for (const x of v) body.append(`${k}[]`, x);
    else body.append(k, v);
  }
  const res = await fetch(url, { method: "POST", body, headers: { "x-requested-with": "XMLHttpRequest" } });
  if (!res.ok) throw new Error(`Lỗi ${res.status}`);
  return res.json();
}

/** Cong tac publish (thay .js-switch + ajax/dashboard/changeStatus). Gia tri 2 = bat, 1 = tat. */
export function StatusSwitch({ model, id, field = "publish", value }: { model: string; id: string; field?: string; value: number }) {
  const [current, setCurrent] = useState(value);
  const [pending, setPending] = useState(false);
  return (
    <Switch
      checked={current === 2}
      disabled={pending}
      aria-label="Đổi trạng thái"
      onCheckedChange={async () => {
        setPending(true);
        try {
          const res = await postForm("/ajax/dashboard/changeStatus", { value: String(current), modelId: id, model, field });
          // Giong server: 1 -> 2, con lai (2, 0...) -> 1
          if (res.flag) setCurrent(current === 1 ? 2 : 1);
          else toast.error("Không cập nhật được trạng thái");
        } catch (e) {
          toast.error((e as Error).message);
        } finally {
          setPending(false);
        }
      }}
    />
  );
}

/** O thu tu (thay .sort-order + ajax/product/updateOrder). */
export function OrderInput({ model, id, defaultValue }: { model: string; id: string; defaultValue: number }) {
  const [saving, setSaving] = useState(false);
  const last = useRef(String(defaultValue));
  return (
    <div className="relative w-20">
      <Input
        type="number"
        defaultValue={defaultValue}
        className="h-8 pr-6 text-right"
        onBlur={async (e) => {
          const v = e.target.value;
          if (v === last.current) return;
          setSaving(true);
          try {
            const res = await fetch(`/ajax/product/updateOrder?${new URLSearchParams({ id, model, order: v })}`).then((r) => r.json());
            if (res.code === 10) {
              last.current = v;
              toast.success("Cập nhật thứ tự thành công");
            } else toast.error("Không cập nhật được thứ tự");
          } finally {
            setSaving(false);
          }
        }}
        onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), e.currentTarget.blur())}
      />
      {saving && <Loader2Icon className="absolute top-2 right-1.5 size-4 animate-spin text-muted-foreground" />}
    </div>
  );
}

type SelectCtx = { selected: Set<string>; toggle: (id: string) => void; setAll: (on: boolean) => void; all: string[] };
const Selection = createContext<SelectCtx | null>(null);

/**
 * Bao bang danh sach: chon nhieu dong + thanh hanh dong "Xuat ban / Bo xuat ban"
 * (thay #checkAll, .checkBoxItem, .changeStatusAll cua library.js).
 */
export function SelectableTable({ model, ids, field = "publish", children, actions = true }: { model: string; ids: string[]; field?: string; children: React.ReactNode; actions?: boolean }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const ctx = useMemo<SelectCtx>(
    () => ({
      selected,
      all: ids,
      toggle: (id) =>
        setSelected((prev) => {
          const next = new Set(prev);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
        }),
      setAll: (on) => setSelected(on ? new Set(ids) : new Set()),
    }),
    [selected, ids],
  );
  const bulk = async (value: 1 | 2) => {
    try {
      await postForm("/ajax/dashboard/changeStatusAll", { value: String(value), model, field, id: [...selected] });
      toast.success(value === 2 ? "Đã xuất bản các bản ghi đã chọn" : "Đã bỏ xuất bản các bản ghi đã chọn");
      setSelected(new Set());
      startTransition(() => router.refresh());
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  return (
    <Selection.Provider value={ctx}>
      {actions && selected.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
          <span>
            Đã chọn <b>{selected.size}</b> bản ghi
          </span>
          <Button size="sm" variant="success" onClick={() => bulk(2)} disabled={isPending}>
            Xuất bản
          </Button>
          <Button size="sm" variant="outline" onClick={() => bulk(1)} disabled={isPending}>
            Bỏ xuất bản
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
            Bỏ chọn
          </Button>
        </div>
      )}
      {children}
    </Selection.Provider>
  );
}

export function SelectAllCheckbox() {
  const ctx = useContext(Selection);
  if (!ctx) return null;
  const all = ctx.all.length > 0 && ctx.selected.size === ctx.all.length;
  const some = ctx.selected.size > 0 && !all;
  return <Checkbox checked={all ? true : some ? "indeterminate" : false} onCheckedChange={(v) => ctx.setAll(v === true)} aria-label="Chọn tất cả" />;
}

export function SelectRowCheckbox({ id }: { id: string }) {
  const ctx = useContext(Selection);
  if (!ctx) return null;
  return <Checkbox checked={ctx.selected.has(id)} onCheckedChange={() => ctx.toggle(id)} aria-label="Chọn dòng" />;
}

/** Cho <TableRow> biet dong dang duoc chon (to mau). */
export function useRowSelected(id: string) {
  return useContext(Selection)?.selected.has(id) ?? false;
}

export function SelectableRow({ id, className, children }: { id: string; className?: string; children: React.ReactNode }) {
  const on = useRowSelected(id);
  return (
    <tr data-state={on ? "selected" : undefined} className={cn("border-b transition-colors hover:bg-muted/40 data-[state=selected]:bg-primary/5", className)}>
      {children}
    </tr>
  );
}

/* ------------------------------------------------------------------ */
/* Bo loc danh sach: tu gui form khi doi select                       */
/* ------------------------------------------------------------------ */

/** <select> trong form loc: doi gia tri la gui form (giong .filter cua library.js). */
export function AutoSubmitField(props: React.ComponentProps<typeof NativeSelect>) {
  return <NativeSelect {...props} onChange={(e) => e.currentTarget.form?.requestSubmit()} />;
}
