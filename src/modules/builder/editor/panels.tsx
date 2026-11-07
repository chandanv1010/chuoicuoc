"use client";

import {
  AlignLeft,
  ArrowDownUp,
  BadgeDollarSign,
  Barcode,
  BookOpenText,
  ChevronsLeftRightEllipsis,
  ChevronsRight,
  Droplet,
  FilterX,
  FolderTree,
  GalleryThumbnails,
  Hash,
  ListChecks,
  ListOrdered,
  MessageSquareText,
  PackageCheck,
  Palette,
  Share2,
  ShieldCheck,
  ShoppingBag,
  SlidersHorizontal,
  Star,
  Stars,
  Table2,
  Truck,
  Zap,
  ChevronRight,
  CircleUser,
  Columns3,
  Database,
  Eye,
  EyeOff,
  FileText,
  GalleryHorizontal,
  GalleryHorizontalEnd,
  Image as ImageIcon,
  LayoutGrid,
  LayoutTemplate,
  Link as LinkIcon,
  Menu,
  Minus,
  Move,
  Newspaper,
  PanelsTopLeft,
  Puzzle,
  RectangleHorizontal,
  Rows3,
  Search,
  ShoppingCart,
  Smile,
  Sparkles,
  Square,
  Type,
  Video,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { LIBRARY } from "../library";
import { effectiveStyle, isAncestor, isContainer, nodeName, type BuilderNode, type NodeType } from "../schema";
import { beginPaletteDrag } from "./canvas";
import { DesignThumb } from "./thumbs";
import { useEditor, useStore } from "./store";

const ICONS: Record<NodeType, React.ComponentType<{ className?: string }>> = {
  page: FileText,
  section: PanelsTopLeft,
  frame: Rows3,
  text: Type,
  image: ImageIcon,
  button: RectangleHorizontal,
  divider: Minus,
  video: Video,
  icon: Smile,
  logo: Sparkles,
  search: Search,
  cart: ShoppingCart,
  account: CircleUser,
  nav: Menu,
  productRow: GalleryHorizontal,
  productGrid: LayoutGrid,
  categoryHero: LayoutTemplate,
  collection: Database,
  slot: Puzzle,
};

const LAYOUT_ICONS = { grid: LayoutGrid, slider: GalleryHorizontalEnd, free: Move } as const;

/** Icon rieng cho tung khoi trang (SLOTS) — bang Lop va bang Chen. */
const SLOT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  breadcrumb: ChevronsRight,
  productGallery: GalleryThumbnails,
  customRequest: MessageSquareText,
  productBuy: ShoppingBag,
  productRating: Star,
  productPrice: BadgeDollarSign,
  productOptions: Palette,
  productStock: PackageCheck,
  productQty: ListOrdered,
  productAddToCart: ShoppingCart,
  productBuyNow: Zap,
  productDelivery: Truck,
  productShipInfo: ShieldCheck,
  productSku: Barcode,
  productBullets: ListChecks,
  productDescription: AlignLeft,
  productDetails: Table2,
  productReviews: MessageSquareText,
  productRelated: GalleryHorizontal,
  filterCategories: FolderTree,
  filterPrice: SlidersHorizontal,
  filterColors: Droplet,
  filterRating: Stars,
  filterClear: FilterX,
  resultCount: Hash,
  sortBar: ArrowDownUp,
  pagination: ChevronsLeftRightEllipsis,
  postBreadcrumb: ChevronsRight,
  postContent: BookOpenText,
  postShare: Share2,
  postShopStory: ShoppingBag,
  catalogueListing: Puzzle,
  postBody: Puzzle,
  postListing: Puzzle,
};

export function NodeIcon({ node, className }: { node: BuilderNode; className?: string }) {
  const bp = useEditor((s) => s.bp);
  const s = effectiveStyle(node, bp);
  const L = s.layout as keyof typeof LAYOUT_ICONS | undefined;
  const Icon =
    (node.type === "frame" || node.type === "section") && L && L in LAYOUT_ICONS
      ? LAYOUT_ICONS[L]
      : node.type === "frame" && s.direction === "row"
        ? Columns3
        : node.type === "slot" && node.props.slot
          ? (SLOT_ICONS[node.props.slot] ?? Puzzle)
          : ICONS[node.type];
  return <Icon className={className} />;
}

/* ----------------------------------- Lop ----------------------------------- */

type Zone = { id: string; where: "before" | "after" | "inside" } | null;

/** Cay lop kieu Figma: bam chon, re chuot de sang tren canvas, keo tha (HTML5 DnD) de doi cho / doi cha. */
export function Layers() {
  const root = useEditor((s) => s.doc.root);
  const [dragging, setDragging] = useState<string | null>(null);
  const [zone, setZone] = useState<Zone>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setCollapsed((c) => {
      const n = new Set(c);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  return (
    <div className="py-1 text-xs" onDragEnd={() => (setDragging(null), setZone(null))}>
      <LayerRow id={root} depth={0} ctx={{ dragging, setDragging, zone, setZone, collapsed, toggle }} />
    </div>
  );
}

type Ctx = {
  dragging: string | null;
  setDragging: (id: string | null) => void;
  zone: Zone;
  setZone: (z: Zone) => void;
  collapsed: Set<string>;
  toggle: (id: string) => void;
};

function LayerRow({ id, depth, ctx }: { id: string; depth: number; ctx: Ctx }) {
  const store = useStore();
  const node = useEditor((s) => s.doc.nodes[id]);
  const selected = useEditor((s) => s.selected === id);
  const hovered = useEditor((s) => s.hovered === id);
  const inSelection = useEditor((s) => !!s.selected && s.selected !== id && isAncestor(s.doc, id, s.selected));
  const hidden = useEditor((s) => (s.doc.nodes[id] ? !!effectiveStyle(s.doc.nodes[id], s.bp).hidden : false));
  if (!node) return null;
  const kids = node.children ?? [];
  const open = !ctx.collapsed.has(id) || inSelection;
  const z = ctx.zone?.id === id ? ctx.zone.where : null;

  const onDragOver = (e: React.DragEvent) => {
    const drag = ctx.dragging;
    if (!drag || drag === id || isAncestor(store.state.doc, drag, id)) return;
    e.preventDefault();
    const r = e.currentTarget.getBoundingClientRect();
    const y = (e.clientY - r.top) / r.height;
    const where: "before" | "after" | "inside" = !node.parent ? "inside" : isContainer(node) ? (y < 0.25 ? "before" : y > 0.75 ? "after" : "inside") : y < 0.5 ? "before" : "after";
    if (z !== where) ctx.setZone({ id, where });
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const drag = ctx.dragging;
    const zone = ctx.zone;
    ctx.setDragging(null);
    ctx.setZone(null);
    if (!drag || !zone) return;
    if (zone.where === "inside") store.move(drag, id, kids.length);
    else {
      const parent = store.state.doc.nodes[node.parent!];
      const i = parent.children!.indexOf(id);
      store.move(drag, parent.id, zone.where === "before" ? i : i + 1);
    }
    store.select(drag);
  };

  return (
    <>
      <div
        draggable={!!node.parent}
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = "move";
          ctx.setDragging(id);
        }}
        onDragOver={onDragOver}
        onDragLeave={() => z && ctx.setZone(null)}
        onDrop={onDrop}
        onClick={() => {
          store.select(id);
          store.iframe?.contentDocument?.querySelector(`[data-node-id="${id}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
        }}
        onDoubleClick={() => {
          const name = prompt("Đổi tên lớp", node.name ?? nodeName(node));
          if (name !== null) store.rename(id, name);
        }}
        onPointerEnter={() => store.hover(id)}
        onPointerLeave={() => store.hover(null)}
        className={cn(
          "group/row relative flex h-7 cursor-default items-center gap-1.5 pr-1 select-none",
          selected ? "bg-[#0d99ff]/15 text-foreground" : inSelection ? "bg-[#0d99ff]/5" : hovered && "outline outline-1 -outline-offset-1 outline-[#0d99ff]/60",
          hidden && "opacity-45",
          ctx.dragging === id && "opacity-40",
          z === "inside" && "bg-[#0d99ff]/20 outline outline-1 -outline-offset-1 outline-[#0d99ff]",
        )}
        style={{ paddingLeft: 6 + depth * 14 }}
      >
        {z === "before" && <span className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-[#0d99ff]" style={{ left: 6 + depth * 14 }} />}
        {z === "after" && <span className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 bg-[#0d99ff]" style={{ left: 6 + depth * 14 }} />}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            ctx.toggle(id);
          }}
          className={cn("grid size-4 place-items-center text-muted-foreground", !kids.length && "invisible")}
        >
          <ChevronRight className={cn("size-3 transition-transform", open && "rotate-90")} />
        </button>
        <NodeIcon node={node} className={cn("size-3.5 shrink-0", isContainer(node) ? "text-[#0d99ff]" : "text-muted-foreground")} />
        <span className={cn("truncate", isContainer(node) && "font-medium")}>{nodeName(node)}</span>
        {node.parent && (
          <button
            type="button"
            title={hidden ? "Hiện lại (ở màn hình đang sửa)" : "Ẩn (ở màn hình đang sửa)"}
            onClick={(e) => {
              e.stopPropagation();
              store.setStyle(id, "hidden", hidden ? (store.state.bp === "base" ? undefined : false) : true);
            }}
            className={cn("ml-auto grid size-5 shrink-0 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground", !hidden && "opacity-0 group-hover/row:opacity-100")}
          >
            {hidden ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
          </button>
        )}
      </div>
      {open && kids.map((k) => <LayerRow key={k} id={k} depth={depth + 1} ctx={ctx} />)}
    </>
  );
}

/* ----------------------------------- Chen ----------------------------------- */

const ITEM_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  section: PanelsTopLeft,
  frameV: Rows3,
  frameH: Columns3,
  heading: Type,
  paragraph: FileText,
  image: ImageIcon,
  button: RectangleHorizontal,
  divider: Minus,
  productRow: GalleryHorizontal,
  productGrid: LayoutGrid,
  categoryHero: LayoutTemplate,
  hero2: LayoutTemplate,
  features3: Columns3,
  grid: LayoutGrid,
  slider: GalleryHorizontalEnd,
  free: Move,
  spacer: Square,
  link: LinkIcon,
  icon: Smile,
  video: Video,
  productSlider: GalleryHorizontalEnd,
  productCards: Database,
  boundProduct: Database,
  categoryCards: Database,
  categoryCircles: Database,
  posts: Newspaper,
  logo: Sparkles,
  search: Search,
  cart: ShoppingCart,
  account: CircleUser,
  nav: Menu,
  bannerSlider: GalleryHorizontalEnd,
};

/** Bang khoi: keo vao canvas (thay vi tri bang duong xanh), hoac bam de chen canh node dang chon. */
export function InsertPanel() {
  const store = useStore();
  const [q, setQ] = useState("");
  const kw = q.trim().toLowerCase();
  const pageKind = useEditor((s) => s.page.kind);
  const groups = LIBRARY.map((g) => ({
    ...g,
    items: g.items
      // Khoi cua trang chi hien trong template / thiet ke rieng dung loai
      .filter((it) => !it.kinds || (pageKind && it.kinds.includes(pageKind)))
      .filter((it) => !kw || `${it.label} ${it.hint ?? ""} ${g.group}`.toLowerCase().includes(kw)),
  })).filter((g) => g.items.length);
  return (
    <div className="space-y-4 p-3">
      <div className="relative">
        <Search className="absolute top-2 left-2 size-3.5 text-muted-foreground" />
        <input
          className="h-8 w-full rounded-md border bg-white pr-2 pl-7 text-xs outline-none focus:border-[#0d99ff]"
          placeholder="Tìm khối: slider, danh mục, nút…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      {groups.map((g) => (
        <div key={g.group}>
          <h3 className="mb-2 text-[11px] font-semibold tracking-wide text-foreground/80 uppercase">{g.group}</h3>
          <div className={g.items[0]?.thumb ? "space-y-2" : "grid grid-cols-2 gap-1.5"}>
            {g.items.map((it) => {
              const drag = (e: React.PointerEvent) => beginPaletteDrag(store, e, () => ({ spec: it.make(), label: it.label }));
              if (it.thumb)
                return (
                  <button
                    key={it.key}
                    type="button"
                    title="Kéo vào canvas hoặc bấm để chèn"
                    onPointerDown={drag}
                    className="block w-full cursor-grab rounded-lg border bg-white p-1.5 text-left transition-all hover:-translate-y-px hover:border-[#0d99ff]/60 hover:shadow-sm active:cursor-grabbing"
                  >
                    <DesignThumb id={it.thumb} />
                    <div className="px-0.5 pt-1.5 text-[11px] font-semibold">{it.label}</div>
                    {it.hint && <div className="px-0.5 text-[10px] leading-snug text-muted-foreground">{it.hint}</div>}
                  </button>
                );
              const Icon = ITEM_ICONS[it.key] ?? (it.key.startsWith("slot-") ? SLOT_ICONS[it.key.slice(5)] : undefined) ?? Rows3;
              return (
                <button
                  key={it.key}
                  type="button"
                  title={it.hint ? `${it.hint} — kéo vào canvas hoặc bấm để chèn` : "Kéo vào canvas hoặc bấm để chèn"}
                  onPointerDown={drag}
                  className="flex cursor-grab flex-col items-center gap-1.5 rounded-lg border bg-white px-2 py-3 text-[11px] font-medium transition-all hover:-translate-y-px hover:border-[#0d99ff]/60 hover:shadow-sm active:cursor-grabbing"
                >
                  <Icon className="size-5 shrink-0 text-muted-foreground" />
                  <span className="line-clamp-2 w-full text-center leading-tight">{it.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
      {!groups.length && <p className="py-6 text-center text-xs text-muted-foreground">Không có khối nào khớp “{q}”.</p>}
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Kéo khối vào canvas: đường xanh cho biết vị trí sẽ chèn; thả sát mép một Frame để chèn cạnh nó thay vì vào trong. Bấm (không kéo) để chèn ngay sau khối đang chọn.
      </p>
    </div>
  );
}
