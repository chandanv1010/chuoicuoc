"use client";

import { closestCenter, DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, rectSortingStrategy, SortableContext, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Command as CommandPrimitive } from "cmdk";
import { CheckIcon, ChevronDownIcon, FileIcon, ImageIcon, ImagePlusIcon, Loader2Icon, PencilIcon, PlusIcon, Trash2Icon, XIcon } from "lucide-react";
import Link from "next/link";
import { createContext, useContext, useEffect, useMemo, useRef, useState, useId } from "react";
import { MediaPicker } from "@/components/admin/media-picker";
import { MoneyInput } from "@/components/admin/money-input";
import { Button } from "@/components/ui/button";
import { Input, Label, NativeSelect } from "@/components/ui/form-controls";
import { Checkbox, Popover, PopoverContent, PopoverTrigger, Switch } from "@/components/ui/interactive";
import { Badge, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/misc";
import { toast } from "@/components/ui/sonner";
import { formatMoney, formatMoneyInput, parseMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

/**
 * Trinh dung bien the san pham — thay public/vendor/backend/library/variant.js + component/variant.blade.php.
 *
 * Gui len dung cac truong ma ProductService (product.ts) doc:
 *   accept, attributeCatalogue[], attribute[<catId>][],
 *   variant[quantity|sku|price|barcode|file_name|file_url|album][], productVariant[name|id][]
 *
 * Luu y thu tu: server lay tich Descartes tren Object.values(input.attribute). Khoa catId la so nen
 * JS sap tang dan (PHP thi giu thu tu form). De dong bien the thu i khop to hop thu i cua server,
 * bang bien the duoc dung tren cac nhom sap theo catId tang dan.
 */

export type AttrValue = { id: string; text: string };
export type VariantData = { quantity: string; sku: string; price: string; barcode: string; file_name: string; file_url: string; album: string };
export type VariantInit = {
  enabled: boolean;
  /** thu tu nhom nhu attributeCatalogue[] da luu */
  groups: { catId: string; values: AttrValue[] }[];
  /** du lieu tung bien the, khoa = id thuoc tinh sap tang, noi bang dau phay (= product_variants.code) */
  rows: Record<string, VariantData>;
  /** products.variant (JSON) khi khong co product_variants: khop theo SKU nhu variant.js */
  legacy: Record<string, string[]> | null;
};

/* ------------------------------------------------------------------ */
/* Dinh dang so                                                        */
/* ------------------------------------------------------------------ */

/** addCommas() cua variant.js / class .int: 1234567 -> "1.234.567" (chi con dung cho so luong; gia dung @/lib/money) */
export function formatThousands(v: string | number | null | undefined) {
  const digits = String(v ?? "").replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/* ------------------------------------------------------------------ */
/* Ngu canh form san pham: gia + ma san pham dung chung cho bien the  */
/* ------------------------------------------------------------------ */

type ProductCtx = { price: string; setPrice: (v: string) => void; code: string; setCode: (v: string) => void };
const ProductForm = createContext<ProductCtx | null>(null);

export function ProductFormProvider({ initialPrice, initialCode, children }: { initialPrice: string; initialCode: string; children: React.ReactNode }) {
  const [price, setPrice] = useState(initialPrice);
  const [code, setCode] = useState(initialCode);
  const value = useMemo(() => ({ price, setPrice, code, setCode }), [price, code]);
  return <ProductForm.Provider value={value}>{children}</ProductForm.Provider>;
}

/**
 * O gia USD ($ 1,234.50; gui "1234.50"). Trong ProductFormProvider thi o name=price dong bo voi
 * gia mac dinh cua bien the moi.
 */
export function PriceInput({ name, defaultValue = "", className, ...props }: Omit<React.ComponentProps<typeof Input>, "defaultValue" | "value" | "onChange" | "type"> & { defaultValue?: string }) {
  const ctx = useContext(ProductForm);
  const synced = !!ctx && name === "price";
  return (
    <MoneyInput
      name={name}
      defaultValue={defaultValue}
      value={synced ? ctx.price : undefined}
      onValueChange={synced ? ctx.setPrice : undefined}
      className={className}
      {...props}
    />
  );
}

/** O "Ma san pham" (name=code) — tien to SKU cua bien the. */
export function CodeInput(props: Omit<React.ComponentProps<typeof Input>, "value" | "onChange" | "name">) {
  const ctx = useContext(ProductForm);
  return <Input name="code" autoComplete="off" value={ctx?.code ?? ""} onChange={(e) => ctx?.setCode(e.target.value)} {...props} />;
}

/* ------------------------------------------------------------------ */
/* Chon gia tri thuoc tinh qua ajax/attribute/getAttribute (select2)  */
/* ------------------------------------------------------------------ */

function AttributeValuePicker({ catId, value, onChange }: { catId: string; value: AttrValue[]; onChange: (v: AttrValue[]) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [result, setResult] = useState<{ term: string; items: AttrValue[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const term = search.trim();

  useEffect(() => {
    if (!open || !term) return;
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const qs = new URLSearchParams({ search: term, "option[attributeCatalogueId]": catId });
        const res = await fetch(`/ajax/attribute/getAttribute?${qs}`, { signal: ctrl.signal, headers: { "x-requested-with": "XMLHttpRequest" } });
        if (!res.ok) throw new Error(`Lỗi ${res.status}`);
        const json = (await res.json()) as { items?: { id: number | string; text: string | null }[] };
        setResult({ term, items: (json.items ?? []).map((i) => ({ id: String(i.id), text: i.text ?? "" })) });
      } catch (e) {
        if (!ctrl.signal.aborted) toast.error(`Không tải được thuộc tính: ${(e as Error).message}`);
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [open, term, catId]);

  const selectedIds = new Set(value.map((v) => v.id));
  const items = term && result?.term === term ? result.items : [];
  const toggle = (item: AttrValue) => onChange(selectedIds.has(item.id) ? value.filter((v) => v.id !== item.id) : [...value, item]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex min-h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-card px-3 py-1.5 text-left text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <span className="flex min-w-0 flex-1 flex-wrap gap-1">
            {value.length ? (
              value.map((v) => (
                <span key={v.id} className="inline-flex max-w-full items-center gap-1 rounded bg-secondary px-1.5 py-0.5 text-xs">
                  <span className="truncate">{v.text}</span>
                  <span
                    role="button"
                    tabIndex={-1}
                    aria-label={`Bỏ ${v.text}`}
                    className="text-muted-foreground hover:text-foreground"
                    onPointerDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      toggle(v);
                    }}
                  >
                    <XIcon className="size-3" />
                  </span>
                </span>
              ))
            ) : (
              <span className="text-muted-foreground">Chọn giá trị thuộc tính...</span>
            )}
          </span>
          <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) min-w-64 p-0" align="start">
        <CommandPrimitive shouldFilter={false} className="flex flex-col">
          <div className="relative">
            <CommandPrimitive.Input
              value={search}
              onValueChange={setSearch}
              placeholder="Nhập từ khóa để tìm giá trị..."
              className="h-9 w-full border-b bg-transparent px-3 pr-8 text-sm outline-none placeholder:text-muted-foreground"
            />
            {loading && <Loader2Icon className="absolute top-2.5 right-2.5 size-4 animate-spin text-muted-foreground" />}
          </div>
          <CommandPrimitive.List className="max-h-64 overflow-y-auto p-1">
            {!term ? (
              <div className="px-2 py-5 text-center text-xs text-muted-foreground">Gõ tên giá trị (ví dụ: Đỏ, XL) để tìm kiếm</div>
            ) : !loading && result?.term === term && items.length === 0 ? (
              <div className="px-2 py-5 text-center text-xs text-muted-foreground">Không tìm thấy giá trị nào</div>
            ) : null}
            {items.map((item) => (
              <CommandPrimitive.Item
                key={item.id}
                value={item.id}
                onSelect={() => toggle(item)}
                className="relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[selected=true]:bg-accent"
              >
                <CheckIcon className={cn("size-4", selectedIds.has(item.id) ? "opacity-100" : "opacity-0")} />
                <span className="truncate">{item.text}</span>
              </CommandPrimitive.Item>
            ))}
          </CommandPrimitive.List>
        </CommandPrimitive>
      </PopoverContent>
    </Popover>
  );
}

/* ------------------------------------------------------------------ */
/* Album bien the (variantAlbum[] -> variant[album][] "a,b,c")         */
/* ------------------------------------------------------------------ */

function SortableImage({ id, url, onRemove }: { id: string; url: string; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("group relative aspect-square cursor-grab overflow-hidden rounded-md border bg-muted/30", isDragging && "z-10 opacity-80 shadow-lg")}
      {...attributes}
      {...listeners}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="" className="size-full object-cover" loading="lazy" />
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={onRemove}
        className="absolute top-1 right-1 flex size-6 items-center justify-center rounded bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-destructive"
        aria-label="Xóa ảnh"
      >
        <Trash2Icon className="size-3.5" />
      </button>
    </div>
  );
}

function VariantAlbum({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const dndId = useId();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  // id = vi tri + url (album co the trung url)
  const ids = value.map((u, i) => `${i}|${u}`);
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    onChange(arrayMove(value, ids.indexOf(String(e.active.id)), ids.indexOf(String(e.over.id))));
  };
  return (
    <div className="grid min-w-0 gap-2 [&>*]:min-w-0">
      {value.length === 0 ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed bg-muted/30 py-6 text-xs text-muted-foreground transition-colors hover:border-primary hover:bg-primary/5"
        >
          <ImagePlusIcon className="size-6" />
          Bấm để chọn ảnh cho phiên bản
        </button>
      ) : (
        <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={ids} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(80px,1fr))] gap-2">
              {value.map((url, i) => (
                <SortableImage key={ids[i]} id={ids[i]} url={url} onRemove={() => onChange(value.filter((_, j) => j !== i))} />
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
      <MediaPicker open={open} multiple onOpenChange={setOpen} onSelect={(urls) => onChange([...value, ...urls])} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* O cap nhat 1 bien the (updateVariantHtml + saveVariantUpdate)       */
/* ------------------------------------------------------------------ */

const albumList = (album: string) => album.split(",").map((s) => s.trim()).filter((s) => s !== "" && s !== "0");

function VariantEditor({ title, data, onSave, onCancel }: { title: string; data: VariantData; onSave: (d: VariantData) => void; onCancel: () => void }) {
  const [draft, setDraft] = useState<VariantData>({ ...data, price: formatMoneyInput(data.price) });
  const [trackStock, setTrackStock] = useState(data.quantity !== "");
  const [hasFile, setHasFile] = useState(data.file_name !== "" || data.file_url !== "");
  const [filePicker, setFilePicker] = useState(false);
  const set = (k: keyof VariantData, v: string) => setDraft((d) => ({ ...d, [k]: v }));

  return (
    <div className="@container grid gap-4 rounded-lg border border-primary/40 bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-medium">Cập nhật phiên bản</div>
          <div className="truncate text-xs text-muted-foreground">{title}</div>
        </div>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
            Hủy bỏ
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() =>
              onSave({
                ...draft,
                quantity: trackStock ? draft.quantity : "",
                file_name: hasFile ? draft.file_name : "",
                file_url: hasFile ? draft.file_url : "",
              })
            }
          >
            Lưu phiên bản
          </Button>
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label>Ảnh phiên bản</Label>
        <VariantAlbum value={albumList(draft.album)} onChange={(list) => set("album", list.join(","))} />
      </div>
      <div className="grid gap-3 rounded-md border bg-muted/20 p-3">
        <label className="flex items-center gap-2 text-sm font-medium">
          <Switch checked={trackStock} onCheckedChange={setTrackStock} /> Quản lý tồn kho
        </label>
        <div className="grid gap-3 @md:grid-cols-2 @3xl:grid-cols-4">
          <div className="grid gap-1.5">
            <Label>Số lượng</Label>
            <Input
              value={draft.quantity}
              inputMode="numeric"
              disabled={!trackStock}
              onChange={(e) => set("quantity", e.target.value.replace(/\D/g, ""))}
              className="text-right"
            />
          </div>
          <div className="grid gap-1.5">
            <Label>SKU</Label>
            <Input value={draft.sku} onChange={(e) => set("sku", e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>Giá</Label>
            <MoneyInput value={draft.price} onValueChange={(v) => set("price", v)} />
          </div>
          <div className="grid gap-1.5">
            <Label>Barcode</Label>
            <Input value={draft.barcode} onChange={(e) => set("barcode", e.target.value)} />
          </div>
        </div>
      </div>
      <div className="grid gap-3 rounded-md border bg-muted/20 p-3">
        <label className="flex items-center gap-2 text-sm font-medium">
          <Switch checked={hasFile} onCheckedChange={setHasFile} /> Quản lý file
        </label>
        <div className="grid gap-3 @md:grid-cols-2">
          <div className="grid gap-1.5">
            <Label>Tên file</Label>
            <Input value={draft.file_name} disabled={!hasFile} onChange={(e) => set("file_name", e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>Đường dẫn</Label>
            <div className="flex gap-2">
              <Input value={draft.file_url} disabled={!hasFile} onChange={(e) => set("file_url", e.target.value)} />
              <Button type="button" variant="outline" disabled={!hasFile} onClick={() => setFilePicker(true)}>
                <FileIcon /> Chọn
              </Button>
            </div>
          </div>
        </div>
        <MediaPicker open={filePicker} type="Files" onOpenChange={setFilePicker} onSelect={(urls) => set("file_url", urls[0] ?? "")} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Trinh dung bien the                                                 */
/* ------------------------------------------------------------------ */

type Group = { key: number; catId: string; values: AttrValue[] };

/** comebineAttribute / reduce(flatMap) cua variant.js */
function cartesian<T>(lists: T[][]): T[][] {
  return lists.reduce<T[][]>((acc, list) => acc.flatMap((combo) => list.map((v) => [...combo, v])), [[]]);
}

const sortIds = (ids: string[]) => [...ids].sort((a, b) => (Number.parseFloat(a) || 0) - (Number.parseFloat(b) || 0));

export function VariantBuilder({ catalogues, init }: { catalogues: { id: string; name: string }[]; init: VariantInit }) {
  const ctx = useContext(ProductForm);
  const mainPrice = ctx?.price ?? "";
  const mainCode = ctx?.code ?? "";
  const counter = useRef(0);
  const [enabled, setEnabled] = useState(init.enabled);
  const [groups, setGroups] = useState<Group[]>(() => init.groups.map((g) => ({ key: counter.current++, catId: g.catId, values: g.values })));
  const [rows, setRows] = useState<Record<string, VariantData>>(init.rows);
  const [editing, setEditing] = useState<string | null>(null);
  const catName = useMemo(() => new Map(catalogues.map((c) => [c.id, c.name])), [catalogues]);

  // Nhom co chon loai + co gia tri, sap theo catId tang (khop thu tu Object.values(attribute) tren server)
  const active = useMemo(
    () => groups.filter((g) => g.catId && g.values.length).sort((a, b) => Number(a.catId) - Number(b.catId)),
    [groups],
  );

  const variants = useMemo(() => {
    if (!active.length) return [];
    return cartesian(active.map((g) => g.values)).map((combo) => {
      const ids = combo.map((v) => v.id);
      const dash = ids.join("-");
      const code = sortIds(ids).join(",");
      let data = rows[code];
      if (!data && init.legacy?.sku) {
        // HT.productVariant(): tim SKU chua "id1-id2"
        const i = init.legacy.sku.findIndex((s) => String(s ?? "").includes(dash));
        if (i !== -1) {
          const pick = (k: string) => String(init.legacy?.[k]?.[i] ?? "");
          data = { quantity: pick("quantity"), sku: pick("sku"), price: pick("price"), barcode: pick("barcode"), file_name: pick("file_name"), file_url: pick("file_url"), album: pick("album") };
        }
      }
      // createVariantRow: SKU mac dinh = ma san pham + "-" + id, gia = gia san pham
      data ??= { quantity: "", sku: `${mainCode}-${dash}`, price: mainPrice, barcode: "", file_name: "", file_url: "", album: "" };
      return { code, dash, combo, name: combo.map((v) => v.text).join(", "), idString: ids.join(", "), data };
    });
  }, [active, rows, init.legacy, mainCode, mainPrice]);

  const editingVariant = variants.find((v) => v.code === editing);
  const usedCatIds = new Set(groups.map((g) => g.catId).filter(Boolean));
  const chosenGroups = groups.filter((g) => g.catId);

  const toggleEnabled = (on: boolean) => {
    // setupProductVariant: phai co Gia va Ma san pham moi bat duoc
    if (on && (mainPrice === "" || mainCode === "")) {
      toast.error("Bạn phải nhập vào Giá và Mã sản phẩm để sử dụng chức năng này");
      return;
    }
    setEnabled(on);
    if (on && groups.length === 0 && catalogues.length) setGroups([{ key: counter.current++, catId: "", values: [] }]);
  };

  const updateGroup = (key: number, patch: Partial<Group>) => setGroups((list) => list.map((g) => (g.key === key ? { ...g, ...patch } : g)));

  return (
    <>
      {/* ---------- Gia tri gui len server ---------- */}
      {enabled && <input type="hidden" name="accept" value="1" />}
      {enabled && chosenGroups.length > 0
        ? chosenGroups.map((g) => (
            <span key={g.key} hidden>
              <input type="hidden" name="attributeCatalogue[]" value={g.catId} />
              {g.values.map((v) => (
                <input key={v.id} type="hidden" name={`attribute[${g.catId}][]`} value={v.id} />
              ))}
            </span>
          ))
        : // tat bien the / chua chon nhom: xoa JSON attributeCatalogue tren products (giong luc tao moi)
          <input type="hidden" name="attributeCatalogue" value="" />}
      {enabled && variants.length > 0 ? (
        variants.map((v) => (
          <span key={v.code} hidden>
            <input type="hidden" name="variant[quantity][]" value={v.data.quantity} />
            <input type="hidden" name="variant[sku][]" value={v.data.sku} />
            <input type="hidden" name="variant[price][]" value={parseMoney(v.data.price) ?? ""} />
            <input type="hidden" name="variant[barcode][]" value={v.data.barcode} />
            <input type="hidden" name="variant[file_name][]" value={v.data.file_name} />
            <input type="hidden" name="variant[file_url][]" value={v.data.file_url} />
            <input type="hidden" name="variant[album][]" value={v.data.album} />
            <input type="hidden" name="productVariant[name][]" value={v.name} />
            <input type="hidden" name="productVariant[id][]" value={v.idString} />
          </span>
        ))
      ) : (
        <input type="hidden" name="variant" value="" />
      )}

      {/* ---------- Chon thuoc tinh ---------- */}
      <div className="@container grid min-w-0 gap-4 [&>*]:min-w-0">
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border bg-muted/30 p-3">
          <Checkbox checked={enabled} onCheckedChange={(v) => toggleEnabled(v === true)} className="mt-0.5" />
          <span className="grid gap-0.5">
            <span className="text-sm font-medium">Sản phẩm này có nhiều phiên bản</span>
            <span className="text-xs text-muted-foreground">
              Ví dụ quần áo có các <b className="text-foreground">màu sắc</b> và <b className="text-foreground">size</b> khác nhau. Mỗi tổ hợp giá trị là một
              phiên bản trong danh sách bên dưới.
            </span>
          </span>
        </label>

        {enabled && (
          <>
            {catalogues.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Chưa có loại thuộc tính nào.{" "}
                <Link href="/attribute/catalogue/create" className="text-primary underline-offset-4 hover:underline">
                  Tạo loại thuộc tính
                </Link>{" "}
                trước khi thêm phiên bản.
              </p>
            ) : (
              <div className="grid gap-3">
                <div className="hidden grid-cols-[200px_minmax(0,1fr)_36px] gap-3 text-xs font-medium tracking-wide text-muted-foreground uppercase @xl:grid">
                  <span>Loại thuộc tính</span>
                  <span>Giá trị</span>
                  <span />
                </div>
                {groups.map((g) => (
                  <div key={g.key} className="grid grid-cols-[minmax(0,1fr)_36px] gap-2 @xl:grid-cols-[200px_minmax(0,1fr)_36px] @xl:gap-3">
                    <NativeSelect
                      value={g.catId}
                      aria-label="Loại thuộc tính"
                      onChange={(e) => updateGroup(g.key, { catId: e.target.value, values: [] })}
                    >
                      <option value="">Chọn loại thuộc tính</option>
                      {catalogues.map((c) => (
                        <option key={c.id} value={c.id} disabled={c.id !== g.catId && usedCatIds.has(c.id)}>
                          {c.name}
                        </option>
                      ))}
                    </NativeSelect>
                    <div className="col-span-2 @xl:col-span-1 @xl:col-start-2 @xl:row-start-1">
                      {g.catId ? (
                        <AttributeValuePicker key={g.catId} catId={g.catId} value={g.values} onChange={(values) => updateGroup(g.key, { values })} />
                      ) : (
                        <Input disabled placeholder="Chọn loại thuộc tính trước" />
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Xóa nhóm thuộc tính"
                      className="col-start-2 row-start-1 text-destructive hover:bg-destructive/10 hover:text-destructive @xl:col-start-3"
                      onClick={() => setGroups((list) => list.filter((x) => x.key !== g.key))}
                    >
                      <Trash2Icon />
                    </Button>
                  </div>
                ))}
                {groups.length < catalogues.length && (
                  <div>
                    <Button type="button" variant="outline" size="sm" onClick={() => setGroups((list) => [...list, { key: counter.current++, catId: "", values: [] }])}>
                      <PlusIcon /> Thêm thuộc tính
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* ---------- Danh sach phien ban ---------- */}
            <div className="grid min-w-0 gap-2 [&>*]:min-w-0">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <div className="text-sm font-medium whitespace-nowrap">
                  Danh sách phiên bản <Badge variant="secondary">{variants.length}</Badge>
                </div>
                {variants.length > 0 && <span className="text-xs text-muted-foreground">Bấm vào một dòng để sửa SKU, giá, tồn kho, ảnh...</span>}
              </div>
              {variants.length === 0 ? (
                <div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
                  Chọn loại thuộc tính và giá trị để tạo phiên bản.
                </div>
              ) : (
                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-14">Ảnh</TableHead>
                        {active.map((g) => (
                          <TableHead key={g.key}>{catName.get(g.catId) ?? g.catId}</TableHead>
                        ))}
                        <TableHead className="text-right">Số lượng</TableHead>
                        <TableHead className="text-right">Giá tiền</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead className="w-12" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {variants.map((v) => {
                        const cover = albumList(v.data.album)[0];
                        const isEditing = editing === v.code;
                        return (
                          <TableRow
                            key={v.code}
                            data-state={isEditing ? "selected" : undefined}
                            className="cursor-pointer"
                            onClick={() => setEditing(isEditing ? null : v.code)}
                          >
                            <TableCell>
                              <span className="flex size-10 items-center justify-center overflow-hidden rounded-md border bg-muted">
                                {cover ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={cover} alt="" className="size-full object-cover" />
                                ) : (
                                  <ImageIcon className="size-4 text-muted-foreground" />
                                )}
                              </span>
                            </TableCell>
                            {v.combo.map((val) => (
                              <TableCell key={val.id}>{val.text}</TableCell>
                            ))}
                            <TableCell className="text-right tabular-nums">{v.data.quantity !== "" ? formatThousands(v.data.quantity) || "0" : "-"}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatMoney(v.data.price)}</TableCell>
                            <TableCell className="font-mono text-xs">{v.data.sku}</TableCell>
                            <TableCell>
                              <Button type="button" variant="ghost" size="icon-sm" aria-label="Sửa phiên bản">
                                <PencilIcon />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
              {editingVariant && (
                <VariantEditor
                  key={editingVariant.code}
                  title={editingVariant.name}
                  data={editingVariant.data}
                  onCancel={() => setEditing(null)}
                  onSave={(d) => {
                    setRows((r) => ({ ...r, [editingVariant.code]: d }));
                    setEditing(null);
                  }}
                />
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}
