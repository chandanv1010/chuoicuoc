"use client";

import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, horizontalListSortingStrategy, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ExternalLinkIcon, GripVerticalIcon, ImageIcon, ImagePlusIcon, Loader2Icon, Trash2Icon } from "lucide-react";
import { useId, useRef, useState } from "react";
import { MediaPicker } from "@/components/admin/media-picker";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/form-controls";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

/**
 * Thay slide.js: danh sach anh slide (them tu thu vien nhieu anh, doi anh, xoa, keo tha sap xep)
 * va keo tha sap xep anh ngay tren bang danh sach (ajax/slide/order).
 */
export type SlideItemValue = { image: string; name: string; description: string; canonical: string; alt: string; window: string };

type Row = SlideItemValue & { key: string };

/**
 * Ten truong co chi so tuong minh (slide[image][0], slide[window][0]...) de checkbox
 * "mo tab moi" khop dung anh cua no. Ban jQuery dung slide[window][] nen checkbox
 * khong tick se lam lech chi so (SlideService::handleSlideItem gan nham cho anh khac).
 */
export function SlideItemsEditor({ defaultValue, error }: { defaultValue: SlideItemValue[]; error?: string }) {
  const counter = useRef(0);
  const nextKey = () => `s${counter.current++}`;
  const [rows, setRows] = useState<Row[]>(() => defaultValue.map((v) => ({ ...v, key: nextKey() })));
  const [adding, setAdding] = useState(false);
  const [replacing, setReplacing] = useState<string | null>(null);
  const dndId = useId();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const update = (key: string, patch: Partial<SlideItemValue>) => setRows((list) => list.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    setRows((list) => arrayMove(list, list.findIndex((r) => r.key === e.active.id), list.findIndex((r) => r.key === e.over!.id)));
  };
  const blank = { name: "", description: "", canonical: "", alt: "", window: "" };

  return (
    <div className="@container grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{rows.length ? `${rows.length} ảnh — kéo biểu tượng ⋮⋮ để đổi thứ tự hiển thị.` : "Chưa có hình ảnh nào được chọn."}</p>
        <Button type="button" variant="outline" size="sm" onClick={() => setAdding(true)}>
          <ImagePlusIcon /> Thêm ảnh
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      {rows.length === 0 ? (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/30 py-12 text-sm text-muted-foreground transition-colors hover:border-primary hover:bg-primary/5"
        >
          <ImagePlusIcon className="size-8" />
          Bấm để chọn ảnh từ thư viện (chọn được nhiều ảnh)
        </button>
      ) : (
        <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={rows.map((r) => r.key)} strategy={verticalListSortingStrategy}>
            <div className="grid gap-3">
              {rows.map((row, i) => (
                <SlideItemCard
                  key={row.key}
                  row={row}
                  index={i}
                  onChange={(patch) => update(row.key, patch)}
                  onPickImage={() => setReplacing(row.key)}
                  onRemove={() => setRows((l) => l.filter((r) => r.key !== row.key))}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
      <MediaPicker
        open={adding}
        multiple
        onOpenChange={setAdding}
        onSelect={(urls) => setRows((l) => [...l, ...urls.map((image) => ({ ...blank, image, key: nextKey() }))])}
      />
      <MediaPicker
        open={replacing !== null}
        onOpenChange={(o) => !o && setReplacing(null)}
        onSelect={(urls) => {
          if (replacing) update(replacing, { image: urls[0] });
          setReplacing(null);
        }}
      />
    </div>
  );
}

function SlideItemCard({ row, index, onChange, onPickImage, onRemove }: { row: Row; index: number; onChange: (p: Partial<SlideItemValue>) => void; onPickImage: () => void; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: row.key });
  const f = (k: keyof SlideItemValue) => `slide[${k}][${index}]`;
  const id = `slide-${row.key}`;
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("relative grid gap-4 rounded-lg border bg-card p-3 @xl:grid-cols-[200px_minmax(0,1fr)]", isDragging && "z-10 shadow-lg ring-2 ring-primary/30")}
    >
      <input type="hidden" name={f("image")} value={row.image} />
      {row.window === "_blank" && <input type="hidden" name={f("window")} value="_blank" />}
      <div className="flex gap-2">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="flex w-6 shrink-0 cursor-grab items-center justify-center rounded text-muted-foreground hover:bg-accent active:cursor-grabbing"
          aria-label="Kéo để sắp xếp"
        >
          <GripVerticalIcon className="size-4" />
        </button>
        <div className="grid min-w-0 flex-1 content-start gap-2">
          <button type="button" onClick={onPickImage} className="group relative aspect-[16/10] overflow-hidden rounded-md border bg-muted/40" title="Đổi ảnh">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={row.image} alt="" className="size-full object-cover" />
            <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
              <ImageIcon className="mr-1 size-4" /> Đổi ảnh
            </span>
          </button>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">Ảnh #{index + 1}</span>
            <Button type="button" variant="ghost" size="sm" className="h-7 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={onRemove}>
              <Trash2Icon /> Xóa
            </Button>
          </div>
        </div>
      </div>
      <div className="grid min-w-0 content-start gap-3 @3xl:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-name`}>Tiêu đề ảnh</Label>
          <Input id={`${id}-name`} name={f("name")} value={row.name} onChange={(e) => onChange({ name: e.target.value })} placeholder="Tiêu đề ảnh" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-alt`}>Mô tả ảnh (alt)</Label>
          <Input id={`${id}-alt`} name={f("alt")} value={row.alt} onChange={(e) => onChange({ alt: e.target.value })} placeholder="Mô tả ảnh" />
        </div>
        <div className="grid gap-1.5 @3xl:col-span-2">
          <Label htmlFor={`${id}-desc`}>Mô tả</Label>
          <Textarea id={`${id}-desc`} name={f("description")} value={row.description} onChange={(e) => onChange({ description: e.target.value })} className="min-h-16" />
        </div>
        <div className="grid gap-1.5 @3xl:col-span-2">
          <Label htmlFor={`${id}-url`}>Liên kết</Label>
          <div className="flex flex-wrap items-center gap-3">
            <Input id={`${id}-url`} name={f("canonical")} value={row.canonical} onChange={(e) => onChange({ canonical: e.target.value })} placeholder="URL" className="min-w-48 flex-1" />
            <label className="flex items-center gap-2 text-sm whitespace-nowrap">
              <input type="checkbox" className="size-4 accent-primary" checked={row.window === "_blank"} onChange={(e) => onChange({ window: e.target.checked ? "_blank" : "" })} />
              <ExternalLinkIcon className="size-3.5 text-muted-foreground" /> Mở trong tab mới
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Bang danh sach: keo tha sap xep anh (HT.changeImageOrder)           */
/* ------------------------------------------------------------------ */

type OrderItem = SlideItemValue & { key: string };

export function SlideOrderStrip({ slideId, items }: { slideId: string; items: SlideItemValue[] }) {
  const [list, setList] = useState<OrderItem[]>(() => items.map((it, i) => ({ ...it, key: `${slideId}-${i}` })));
  const [saving, setSaving] = useState(false);
  const dndId = useId();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const save = async (next: OrderItem[]) => {
    // Cung du lieu nhu jQuery: payload[i][id|image|name|alt|description|canonical|window]
    const body = new URLSearchParams();
    next.forEach((it, i) => {
      body.append(`payload[${i}][id]`, slideId);
      for (const k of ["image", "name", "alt", "description", "canonical", "window"] as const) body.append(`payload[${i}][${k}]`, it[k]);
    });
    setSaving(true);
    try {
      const res = await fetch("/ajax/slide/order", { method: "POST", body, headers: { "x-requested-with": "XMLHttpRequest" } });
      if (!res.ok) throw new Error(`Lỗi ${res.status}`);
      toast.success("Đã cập nhật thứ tự ảnh");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const next = arrayMove(list, list.findIndex((r) => r.key === e.active.id), list.findIndex((r) => r.key === e.over!.id));
    setList(next);
    void save(next);
  };

  if (!list.length) return <span className="text-xs text-muted-foreground">Chưa có ảnh</span>;
  return (
    <div className="flex items-center gap-2">
      <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={list.map((r) => r.key)} strategy={horizontalListSortingStrategy}>
          <div className="flex flex-wrap gap-1.5">
            {list.map((it) => (
              <OrderThumb key={it.key} id={it.key} src={it.image ? it.image.replace("/public/", "/") : "/backend/img/not-found.jpg"} title={it.name || it.alt} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      {saving && <Loader2Icon className="size-4 animate-spin text-muted-foreground" />}
    </div>
  );
}

function OrderThumb({ id, src, title }: { id: string; src: string; title: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <span
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      title={title || "Kéo để sắp xếp"}
      className={cn("block size-11 cursor-grab overflow-hidden rounded-md border bg-muted active:cursor-grabbing", isDragging && "z-10 shadow-md ring-2 ring-primary/40")}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className="pointer-events-none size-full object-cover" />
    </span>
  );
}
