"use client";

import {
  closestCenter,
  DndContext,
  DragOverlay,
  MeasuringStrategy,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
  type DragOverEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GitBranchPlusIcon, GripVerticalIcon, Loader2Icon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useId, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/interactive";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

/**
 * Cay menu keo tha nhieu cap (thay jquery.nestable + HT.updateNestableOutput cua menu.js).
 * Sau moi lan tha: gui ajax/menu/drag voi json = [{id, children:[...]}] giong nestable('serialize').
 * Toi da 5 cap (maxDepth mac dinh cua nestable).
 */
export type TreeNode = { id: number; name: string; children: TreeNode[] };

type Flat = { id: number; name: string; parentId: number | null; depth: number };

const INDENT = 28;
const MAX_DEPTH = 4; // 0..4 = 5 cap

function flatten(nodes: TreeNode[], parentId: number | null = null, depth = 0): Flat[] {
  return nodes.flatMap((n) => [{ id: n.id, name: n.name, parentId, depth }, ...flatten(n.children, n.id, depth + 1)]);
}

function build(flat: Flat[]): TreeNode[] {
  const root: TreeNode[] = [];
  const map = new Map<number, TreeNode>();
  for (const f of flat) map.set(f.id, { id: f.id, name: f.name, children: [] });
  for (const f of flat) {
    const node = map.get(f.id)!;
    if (f.parentId === null) root.push(node);
    else (map.get(f.parentId)?.children ?? root).push(node);
  }
  return root;
}

/** nestable('serialize'): {id} + children khi co */
function serialize(nodes: TreeNode[]): unknown[] {
  return nodes.map((n) => (n.children.length ? { id: n.id, children: serialize(n.children) } : { id: n.id }));
}

function descendantsOf(flat: Flat[], id: number): Set<number> {
  const out = new Set<number>();
  let grew = true;
  while (grew) {
    grew = false;
    for (const f of flat) if (f.parentId !== null && (f.parentId === id || out.has(f.parentId)) && !out.has(f.id)) (out.add(f.id), (grew = true));
  }
  return out;
}

function projection(items: Flat[], activeId: number, overId: number, offset: number, subtreeHeight: number) {
  const overIndex = items.findIndex((i) => i.id === overId);
  const activeIndex = items.findIndex((i) => i.id === activeId);
  const active = items[activeIndex];
  const moved = arrayMove(items, activeIndex, overIndex);
  const prev = moved[overIndex - 1];
  const next = moved[overIndex + 1];
  const projected = active.depth + Math.round(offset / INDENT);
  const maxDepth = Math.min(prev ? prev.depth + 1 : 0, MAX_DEPTH - subtreeHeight);
  const minDepth = next ? next.depth : 0;
  const depth = Math.max(Math.min(projected, maxDepth), Math.min(minDepth, maxDepth), 0);
  let parentId: number | null = null;
  if (depth > 0 && prev) {
    if (depth === prev.depth) parentId = prev.parentId;
    else if (depth > prev.depth) parentId = prev.id;
    else parentId = moved.slice(0, overIndex).reverse().find((i) => i.depth === depth)?.parentId ?? null;
  }
  return { depth, parentId };
}

export function MenuTree({ initial, catalogueId }: { initial: TreeNode[]; catalogueId: string }) {
  const [tree, setTree] = useState(initial);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [overId, setOverId] = useState<number | null>(null);
  const [offset, setOffset] = useState(0);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState<Flat | null>(null);
  const dndId = useId();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const flat = useMemo(() => flatten(tree), [tree]);
  // Dang keo: an cac menu con cua muc dang keo (chung di theo cha)
  const hidden = useMemo(() => (activeId === null ? new Set<number>() : descendantsOf(flat, activeId)), [flat, activeId]);
  const visible = useMemo(() => flat.filter((f) => !hidden.has(f.id)), [flat, hidden]);
  const subtreeHeight = useMemo(() => {
    if (activeId === null) return 0;
    const base = flat.find((f) => f.id === activeId)?.depth ?? 0;
    return Math.max(0, ...flat.filter((f) => hidden.has(f.id)).map((f) => f.depth - base));
  }, [flat, hidden, activeId]);
  const projected = activeId !== null && overId !== null ? projection(visible, activeId, overId, offset, subtreeHeight) : null;
  const activeItem = activeId !== null ? flat.find((f) => f.id === activeId) : undefined;

  const reset = () => {
    setActiveId(null);
    setOverId(null);
    setOffset(0);
  };

  const save = async (next: TreeNode[], prev: TreeNode[]) => {
    setSaving(true);
    try {
      const body = new URLSearchParams({ json: JSON.stringify(serialize(next)), menu_catalogue_id: catalogueId });
      const res = await fetch("/ajax/menu/drag", { method: "POST", body, headers: { "x-requested-with": "XMLHttpRequest" } });
      if (!res.ok) throw new Error(`Lỗi ${res.status}`);
      toast.success("Đã lưu vị trí menu");
    } catch (e) {
      setTree(prev);
      toast.error(`Không lưu được: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    const proj = projected;
    reset();
    if (!over || !proj) return;
    const all = flatten(tree);
    const activeIndex = all.findIndex((f) => f.id === active.id);
    const overIndex = all.findIndex((f) => f.id === over.id);
    const cur = all[activeIndex];
    if (activeIndex === overIndex && cur.depth === proj.depth && cur.parentId === proj.parentId) return;
    // Con chau van tro parentId ve muc dang keo nen build() tu dua chung theo cha
    all[activeIndex] = { ...cur, depth: proj.depth, parentId: proj.parentId };
    const next = build(arrayMove(all, activeIndex, overIndex));
    const prev = tree;
    setTree(next);
    void save(next, prev);
  };

  const remove = async (item: Flat) => {
    try {
      const res = await fetch("/ajax/menu/deleteMenu", {
        method: "POST",
        body: new URLSearchParams({ menu_id: String(item.id) }),
        headers: { "x-requested-with": "XMLHttpRequest" },
      });
      const text = await res.text();
      if (!res.ok || text) throw new Error(text || `Lỗi ${res.status}`);
      const sub = descendantsOf(flat, item.id);
      setTree(build(flat.filter((f) => f.id !== item.id && !sub.has(f.id))));
      toast.success("Đã xóa menu");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  if (!tree.length) {
    return (
      <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
        Vị trí này chưa có menu nào. Bấm “Cập nhật menu cấp 1” để thêm.
      </div>
    );
  }

  return (
    <div className="relative">
      {saving && (
        <div className="absolute -top-8 right-0 flex items-center gap-1 text-xs text-muted-foreground">
          <Loader2Icon className="size-3.5 animate-spin" /> Đang lưu...
        </div>
      )}
      <DndContext
        id={dndId}
        sensors={sensors}
        collisionDetection={closestCenter}
        measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
        onDragStart={({ active }: DragStartEvent) => {
          setActiveId(Number(active.id));
          setOverId(Number(active.id));
        }}
        onDragMove={({ delta }: DragMoveEvent) => setOffset(delta.x)}
        onDragOver={({ over }: DragOverEvent) => setOverId(over ? Number(over.id as UniqueIdentifier) : null)}
        onDragEnd={onDragEnd}
        onDragCancel={reset}
      >
        <SortableContext items={visible.map((f) => f.id)} strategy={verticalListSortingStrategy}>
          <ul className="grid grid-cols-[minmax(0,1fr)] gap-1.5">
            {visible.map((f) => (
              <TreeItem
                key={f.id}
                item={f}
                depth={f.id === activeId && projected ? projected.depth : f.depth}
                childCount={descendantsOf(flat, f.id).size}
                ghost={f.id === activeId}
                onDelete={() => setConfirm(f)}
              />
            ))}
          </ul>
        </SortableContext>
        <DragOverlay dropAnimation={null}>
          {activeItem ? (
            <div className="flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm shadow-lg">
              <GripVerticalIcon className="size-4 text-muted-foreground" />
              <span className="font-medium">{activeItem.name}</span>
              {hidden.size > 0 && <span className="rounded bg-muted px-1.5 text-xs text-muted-foreground">+{hidden.size}</span>}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
      <Dialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xóa menu “{confirm?.name}”?</DialogTitle>
            <DialogDescription>Menu và toàn bộ menu con của nó sẽ bị xóa khỏi hệ thống. Không thể khôi phục.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setConfirm(null)}>
              Hủy
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                const item = confirm;
                setConfirm(null);
                if (item) void remove(item);
              }}
            >
              <Trash2Icon /> Xóa menu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TreeItem({ item, depth, childCount, ghost, onDelete }: { item: Flat; depth: number; childCount: number; ghost: boolean; onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.id });
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition, paddingLeft: depth * INDENT }} className="min-w-0 list-none">
      <div
        className={cn(
          "flex items-center gap-2 rounded-md border bg-card px-2 py-1.5 text-sm",
          depth > 0 && "border-l-2 border-l-primary/40",
          ghost && "border-dashed border-primary bg-primary/5 opacity-70",
        )}
      >
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="flex size-7 shrink-0 cursor-grab items-center justify-center rounded text-muted-foreground hover:bg-accent active:cursor-grabbing"
          aria-label={`Kéo menu ${item.name}`}
        >
          <GripVerticalIcon className="size-4" />
        </button>
        <span className="min-w-0 flex-1 truncate font-medium">{item.name}</span>
        <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">Cấp {depth + 1}</span>
        {childCount > 0 && <span className="shrink-0 rounded bg-muted px-1.5 text-xs text-muted-foreground">{childCount} con</span>}
        <Button asChild variant="ghost" size="sm" className="h-7 shrink-0">
          <Link href={`/menu/${item.id}/children`}>
            <GitBranchPlusIcon /> <span className="hidden sm:inline">Menu con</span>
          </Link>
        </Button>
        <Button type="button" variant="ghost" size="icon-sm" className="shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={onDelete} aria-label="Xóa menu">
          <Trash2Icon />
        </Button>
      </div>
    </li>
  );
}
