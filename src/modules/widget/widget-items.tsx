"use client";

import { closestCenter, DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CheckIcon, GripVerticalIcon, Loader2Icon, PackageOpenIcon, SearchIcon, XIcon } from "lucide-react";
import { useEffect, useRef, useState, useId } from "react";
import { Field } from "@/components/admin/fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form-controls";
import { cn } from "@/lib/utils";

/**
 * Cau hinh noi dung widget (thay widget.js): chon module (radio name=model), tim doi tuong qua
 * GET ajax/dashboard/findModelObject?model=&keyword= (JSON Eloquent kem languages[0].pivot),
 * bam de them / bo, keo tha sap xep; gui modelItem[id][], modelItem[name][], modelItem[image][].
 */
type Item = { id: string; name: string; image: string };
type Found = { id: number | string; name?: string; canonical?: string; image?: string | null; languages?: { pivot?: { name?: string; canonical?: string } }[] };

function SortableItem({ item, onRemove }: { item: Item; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("flex items-center gap-3 rounded-lg border bg-card px-2 py-2", isDragging && "z-10 shadow-lg")}
    >
      <input type="hidden" name="modelItem[id][]" value={item.id} />
      <input type="hidden" name="modelItem[name][]" value={item.name} />
      <input type="hidden" name="modelItem[image][]" value={item.image} />
      <button type="button" {...attributes} {...listeners} className="cursor-grab text-muted-foreground" aria-label="Kéo để sắp xếp">
        <GripVerticalIcon className="size-4" />
      </button>
      <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {item.image ? <img src={item.image} alt="" className="size-full object-cover" /> : <PackageOpenIcon className="size-4 text-muted-foreground" />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{item.name}</div>
        <div className="text-xs text-muted-foreground">ID {item.id}</div>
      </div>
      <Button type="button" variant="ghost" size="icon-sm" onClick={onRemove} aria-label="Bỏ mục" className="text-muted-foreground hover:text-destructive">
        <XIcon />
      </Button>
    </div>
  );
}

export function WidgetItems({ models, defaultModel, defaultItems }: { models: Record<string, string>; defaultModel: string; defaultItems: Item[] }) {
  const [model, setModel] = useState(defaultModel);
  const [keyword, setKeyword] = useState("");
  const [items, setItems] = useState<Item[]>(defaultItems);
  const [results, setResults] = useState<Item[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [hint, setHint] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);
  const dndId = useId();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  // Tim kiem (debounce 300ms nhu doneTyingInterval)
  useEffect(() => {
    if (!model || keyword.trim().length < 2) {
      setResults(null);
      return;
    }
    let alive = true;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/ajax/dashboard/findModelObject?${new URLSearchParams({ model, keyword })}`, { headers: { "x-requested-with": "XMLHttpRequest" } });
        const data = (res.ok ? await res.json() : []) as Found[];
        if (!alive) return;
        setResults(
          data.map((d) => ({
            id: String(d.id),
            name: d.languages?.[0]?.pivot?.name ?? d.name ?? "",
            image: d.image ?? "",
          })),
        );
      } finally {
        if (alive) setLoading(false);
      }
    }, 300);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [model, keyword]);

  // Bam ra ngoai thi dong ket qua (unfocusSearchBox)
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setResults(null);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const toggle = (r: Item) => setItems((list) => (list.some((x) => x.id === r.id) ? list.filter((x) => x.id !== r.id) : [...list, r]));

  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    setItems((list) => arrayMove(list, list.findIndex((i) => i.id === e.active.id), list.findIndex((i) => i.id === e.over!.id)));
  };

  return (
    <div className="grid gap-4">
      <Field label="Chọn module" hint="Đổi module chỉ đổi nguồn tìm kiếm; các mục đã chọn được giữ nguyên.">
        <div className="flex flex-wrap gap-2" role="radiogroup">
          {Object.entries(models).map(([key, label]) => (
            <label
              key={key}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition-colors hover:bg-accent",
                model === key && "border-primary bg-primary/5 text-primary",
              )}
            >
              <input type="radio" name="model" value={key} checked={model === key} onChange={() => setModel(key)} className="accent-[var(--primary)]" />
              {label}
            </label>
          ))}
        </div>
      </Field>

      <div ref={boxRef} className="relative">
        <SearchIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={keyword}
          onChange={(e) => {
            if (!model) {
              setHint("Bạn chưa chọn Module");
              return;
            }
            setHint("");
            setKeyword(e.target.value);
          }}
          onFocus={() => !model && setHint("Bạn chưa chọn Module")}
          placeholder="Nhập ít nhất 2 ký tự để tìm đối tượng..."
          className="pl-8"
          autoComplete="off"
        />
        {loading && <Loader2Icon className="absolute top-2.5 right-2.5 size-4 animate-spin text-muted-foreground" />}
        {results && (
          <div className="absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-lg border bg-popover p-1 shadow-lg">
            {results.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">Không tìm thấy đối tượng nào</div>
            ) : (
              results.map((r) => {
                const on = items.some((x) => x.id === r.id);
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => toggle(r)}
                    className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
                  >
                    <span className="truncate">{r.name}</span>
                    <CheckIcon className={cn("size-4 shrink-0 text-primary", on ? "opacity-100" : "opacity-0")} />
                  </button>
                );
              })
            )}
          </div>
        )}
        {hint && <p className="mt-1 text-xs text-destructive">{hint}</p>}
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">Chưa có đối tượng nào. Tìm và bấm vào kết quả để thêm.</div>
      ) : (
        <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            <div className="grid gap-2">
              {items.map((item) => (
                <SortableItem key={item.id} item={item} onRemove={() => setItems((l) => l.filter((x) => x.id !== item.id))} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
