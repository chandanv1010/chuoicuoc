"use client";

import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignStartVertical,
  StretchHorizontal,
  StretchVertical,
  Wand2,
  AlignCenter,
  AlignHorizontalJustifyCenter,
  AlignHorizontalJustifyEnd,
  AlignHorizontalJustifyStart,
  AlignHorizontalSpaceBetween,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowRight,
  CaseUpper,
  Copy,
  Crop,
  Database,
  Group,
  ImagePlus,
  Link2,
  Play,
  Trash2,
  Unlink2,
  WrapText,
} from "lucide-react";
import { useState } from "react";
import { MediaPicker } from "@/components/admin/media-picker";
import { cn } from "@/lib/utils";
import {
  ANIM_LABEL,
  BREAKPOINTS,
  collectionOf,
  dataKindOf,
  defaultPerView,
  itemStyle,
  effectiveStyle,
  hasLayout,
  hasSlider,
  adjustFilter,
  HOVER_LABEL,
  isContainer,
  isProducts,
  KIND_LABEL,
  KIND_RECORD,
  layoutOf,
  RECORD_FIELDS,
  SLOT_DESIGNS,
  SLOTS,
  SOURCE_LABEL,
  TYPE_LABEL,
  type AnimType,
  type BuilderNode,
  type Hover,
  type ImageAdjust,
  type Layout,
  type NodeProps,
  type PartKind,
  type ProductSource,
  type RecordKind,
  type Size,
  type SliderOpts,
  type Style,
} from "../schema";
import { CARD_DESIGNS, customizableSpec } from "../library";
import { startCrop } from "./canvas";
import { DesignThumb } from "./thumbs";
import { AlignPad, ColorField, fieldCls, NumberField, Row, Section, Segmented, Select, TextField, Toggle } from "./controls";
import { IconPicker, LinksEditor, RecordPicker } from "./pickers";
import { useEditor, useStore } from "./store";

export type CatalogueOption = { id: number; name: string; count: number; level?: number };

/** Header / footer thiet ke rieng (bang builder_pages) de chon trong "Cài đặt trang". */
export type PartOption = { slug: string; title: string; kind: PartKind };

/** Bang thuoc tinh ben phai: noi dung / du lieu + bo cuc + kich thuoc + giao dien + hieu ung, sua theo breakpoint. */
export function Inspector({ catalogues, parts }: { catalogues: CatalogueOption[]; parts: PartOption[] }) {
  const selected = useEditor((s) => s.selected);
  const node = useEditor((s) => (s.selected ? s.doc.nodes[s.selected] : undefined));
  const bp = useEditor((s) => s.bp);

  if (!selected || !node)
    return (
      <div>
        <PageSettingsPanel parts={parts} />
      <div className="p-4 text-xs leading-relaxed text-muted-foreground">
        <p className="mb-3 font-medium text-foreground">Chưa chọn phần tử nào</p>
        <p>Bấm vào một khối trên canvas hoặc trong bảng Lớp.</p>
        <ul className="mt-3 list-disc space-y-1 pl-4">
          <li>Bấm trúng khối nào thì chọn khối đó; thanh dưới canvas để chọn khung cha</li>
          <li>Kéo khối (hoặc kéo nhãn tên xanh) để đổi vị trí; kéo ô vuông ở góc để đổi kích thước</li>
          <li>Nhấp đúp vào chữ để sửa, vào ảnh để crop</li>
          <li>Chuột phải: copy, dán, nhân bản, xóa…</li>
          <li>Ctrl+C / Ctrl+V · Ctrl+D nhân bản · Ctrl+G bọc Frame · Delete xóa · Esc chọn khung cha</li>
        </ul>
      </div>
      </div>
    );
  if (node.type === "page")
    return (
      <>
        <PageSettingsPanel parts={parts} />
        <NodeInspectorRoute node={node} bp={bp} catalogues={catalogues} />
      </>
    );
  return <NodeInspectorRoute node={node} bp={bp} catalogues={catalogues} />;
}

/**
 * "Cài đặt trang": header / footer cua trang nay (dung chung / an / thiet ke rieng) + SEO cho landing page.
 * Khong hien khi dang sua chinh header / footer.
 */
function PageSettingsPanel({ parts }: { parts: PartOption[] }) {
  const store = useStore();
  const settings = useEditor((s) => s.doc.settings) ?? {};
  const page = useEditor((s) => s.page);
  const [picker, setPicker] = useState(false);
  if (page.part) return null;
  const options = (kind: PartKind) => [
    { value: "global", label: "Dùng chung (mọi trang)" },
    { value: "none", label: "Ẩn — không hiện" },
    ...parts.filter((p) => p.kind === kind).map((p) => ({ value: p.slug, label: p.title })),
  ];
  const value = (kind: PartKind) => {
    const v = settings[kind];
    return v && (v === "none" || parts.some((p) => p.slug === v)) ? v : "global";
  };
  return (
    <Section title="Cài đặt trang">
      <Row label="Header">
        <Select value={value("header")} options={options("header")} onChange={(v) => store.setSettings({ header: v })} />
      </Row>
      <Row label="Footer">
        <Select value={value("footer")} options={options("footer")} onChange={(v) => store.setSettings({ footer: v })} />
      </Row>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Thiết kế header / footer riêng ở <a href="/builder/index#parts" className="text-[#0d99ff] hover:underline">Trình dựng giao diện → Header / Footer riêng</a>. Áp dụng khi bấm Xuất bản.
      </p>
      {page.landing && (
        <>
          <p className="pt-1 text-[11px] font-semibold tracking-wide text-foreground uppercase">SEO · /{page.landing}.html</p>
          <Row label="Tiêu đề">
            <TextField value={settings.seoTitle} placeholder="Mặc định: tên trang" onChange={(v) => store.setSettings({ seoTitle: v })} />
          </Row>
          <Row label="Mô tả">
            <TextField multiline value={settings.seoDescription} placeholder="Hiện dưới tiêu đề trên Google" onChange={(v) => store.setSettings({ seoDescription: v })} />
          </Row>
          <Row label="Ảnh chia sẻ">
            <div className="flex min-w-0 flex-1 gap-1">
              <TextField value={settings.seoImage} placeholder="Ảnh khi chia sẻ Facebook / Zalo" onChange={(v) => store.setSettings({ seoImage: v })} />
              <button type="button" onClick={() => setPicker(true)} className="shrink-0 rounded-md border px-2 text-[11px] hover:bg-muted">
                Chọn
              </button>
            </div>
          </Row>
          <MediaPicker open={picker} onOpenChange={setPicker} onSelect={(urls) => urls[0] && store.setSettings({ seoImage: urls[0] })} />
        </>
      )}
    </Section>
  );
}

/**
 * Node nam trong the mau cua "Danh sách dữ liệu": chon giua sua the mau (moi the doi theo) va sua rieng the dang
 * chon (ghi vao perItem cua danh sach). Inspector ben duoi dung chung, chi khac noi ghi va gia tri hien.
 */
function NodeInspectorRoute({ node, bp, catalogues }: { node: BuilderNode; bp: Bp; catalogues: CatalogueOption[] }) {
  const store = useStore();
  const doc = useEditor((s) => s.doc);
  const copy = useEditor((s) => s.selectedCopy);
  const mode = useEditor((s) => s.itemMode);
  const coll = collectionOf(doc, node.id);
  const one = !!coll && copy !== null && mode === "one";
  const ovr = one ? coll.props.perItem?.[copy]?.[node.id] : undefined;
  const hasOwn = !!coll && copy !== null && !!coll.props.perItem?.[copy] && Object.keys(coll.props.perItem[copy]).length > 0;
  const target: Target = one
    ? {
        style: (b) => itemStyle(node, ovr, b),
        own: ovr?.style?.[bp] ?? {},
        overrideAlways: true,
        set: (k, v) => store.setItemStyle(coll.id, copy, node.id, k, v),
        setProp: (patch) => store.setItemProps(coll.id, copy, node.id, patch),
        view: ovr?.props ? { ...node, props: { ...node.props, ...ovr.props } } : node,
      }
    : {
        style: (b) => effectiveStyle(node, b),
        own: node.style[bp] ?? {},
        overrideAlways: false,
        set: (k, v) => store.setStyle(node.id, k, v),
        setProp: (patch) => store.setProps(node.id, patch),
        view: node,
      };
  return (
    <>
      {coll && (
        <div className="border-b bg-violet-50 px-3 py-2.5 text-[11px] text-violet-900">
          {copy === null ? (
            <p>Khối này nằm trong thẻ mẫu của “Danh sách dữ liệu” — sửa ở đây thì mọi thẻ đổi theo. Bấm vào một thẻ trên canvas để sửa riêng thẻ đó.</p>
          ) : (
            <>
              <div className="mb-1.5 font-medium">Thẻ thứ {copy + 1} trong danh sách — sửa cho:</div>
              <Segmented
                value={mode}
                onChange={(v) => store.set({ itemMode: v })}
                options={[
                  { value: "all", label: "Mọi thẻ (thẻ mẫu)" },
                  { value: "one", label: `Chỉ thẻ thứ ${copy + 1}` },
                ]}
              />
              {hasOwn && (
                <button type="button" onClick={() => store.clearItem(coll.id, copy)} className="mt-1.5 text-violet-700 hover:underline">
                  Bỏ mọi tùy chỉnh riêng của thẻ thứ {copy + 1}
                </button>
              )}
            </>
          )}
        </div>
      )}
      <NodeInspector key={`${node.id}:${one ? copy : "all"}`} node={node} bp={bp} catalogues={catalogues} target={target} />
    </>
  );
}

type Target = {
  style: (bp: Bp) => Style;
  own: Style;
  /** che do "chi the nay": moi gia tri ghi de deu danh dau (ke ca o Desktop) */
  overrideAlways: boolean;
  set: <K extends keyof Style>(key: K, v: Style[K] | undefined) => void;
  setProp: (patch: Partial<NodeProps>) => void;
  view: BuilderNode;
}

type Bp = (typeof BREAKPOINTS)[number]["key"];

function NodeInspector({ node: raw, bp, catalogues, target }: { node: BuilderNode; bp: Bp; catalogues: CatalogueOption[]; target: Target }) {
  const store = useStore();
  const doc = useEditor((s) => s.doc);
  const node = target.view;
  const s = target.style(bp);
  const container = isContainer(node);
  const own = target.own;
  const set = target.set;
  const ov = (key: keyof Style) => ({ overridden: (target.overrideAlways || bp !== "base") && key in own, onReset: () => set(key, undefined) });
  const setProp = target.setProp;
  void raw;
  const textLike = ["text", "button", "icon", "cart", "account", "nav", "search"].includes(node.type);
  const bpLabel = BREAKPOINTS.find((b) => b.key === bp)!.label;
  const parent = node.parent ? doc.nodes[node.parent] : null;
  const parentLayout = parent ? layoutOf(parent, effectiveStyle(parent, bp)) : null;
  // Template trang con: moi khoi deu dung duoc {{truong}} cua ban ghi dang xem
  const pageKind = useEditor((st) => st.page.kind);
  const kind = dataKindOf(doc, node.id) ?? (pageKind ? KIND_RECORD[pageKind] : null);

  return (
    <div className="pb-10">
      <div className="flex items-center gap-1 border-b px-3 py-2.5">
        <input
          className="h-7 min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1.5 text-sm font-semibold outline-none hover:border-border focus:border-[#0d99ff]"
          defaultValue={node.name ?? ""}
          placeholder={TYPE_LABEL[node.type]}
          onBlur={(e) => e.target.value !== (node.name ?? "") && store.rename(node.id, e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        />
        {node.parent && (
          <>
            <IconBtn title="Bọc vào Frame (Ctrl+G)" onClick={() => store.wrap(node.id)}>
              <Group className="size-3.5" />
            </IconBtn>
            <IconBtn title="Nhân bản (Ctrl+D)" onClick={() => store.duplicate(node.id)}>
              <Copy className="size-3.5" />
            </IconBtn>
            <IconBtn title="Xóa (Delete)" onClick={() => store.remove(node.id)} danger>
              <Trash2 className="size-3.5" />
            </IconBtn>
          </>
        )}
      </div>
      {bp !== "base" && (
        <div className="border-b bg-[#0d99ff]/8 px-3 py-2 text-[11px] leading-snug text-[#0a6fbf]">
          Đang sửa riêng cho <b>{bpLabel}</b>. Giá trị có chấm xanh là ghi đè; còn lại kế thừa từ màn hình lớn hơn.
        </div>
      )}

      <ContentSection node={node} setProp={setProp} catalogues={catalogues} kind={kind} imageAdjust={{ value: s.adjust, onChange: (v) => set("adjust", v) }} />
      {node.type === "collection" && <DesignGallery node={node} />}
      {container && <BindSection node={node} setProp={setProp} kind={kind} />}

      {hasLayout(node) && <LayoutSection node={node} s={s} set={set} ov={ov} />}
      {hasSlider(node) && <SliderSection opts={node.props.slider ?? {}} onChange={(slider) => setProp({ slider })} />}

      {node.parent && (
        <Section title="Vị trí">
          {parentLayout === "free" ? (
            <p className="text-[11px] text-muted-foreground">Nằm trong Khung tự do — kéo trên canvas (tự bắt lưới 4px, giữ Alt để tắt) hoặc nhập toạ độ.</p>
          ) : (
            <Toggle
              checked={s.position === "absolute"}
              onChange={(v) => {
                if (v) {
                  // Giu nguyen cho dang dung khi tach khoi bo cuc
                  const el = store.iframe?.contentDocument?.querySelector<HTMLElement>(`[data-node-id="${node.id}"]`);
                  store.setStyles(node.id, { position: "absolute", x: el?.offsetLeft ?? 0, y: el?.offsetTop ?? 0 }, "abs");
                } else set("position", undefined);
              }}
              label="Vị trí tự do (tách khỏi bố cục, đặt đè lên)"
            />
          )}
          {(parentLayout === "free" || s.position === "absolute") && <AlignInParent id={node.id} />}
          {(parentLayout === "free" || s.position === "absolute") && (
            <Row label="X / Y / lớp" {...ov("x")}>
              <NumberField label="X" value={s.x ?? 0} min={-2000} onChange={(v) => set("x", v)} />
              <NumberField label="Y" value={s.y ?? 0} min={-2000} onChange={(v) => set("y", v)} />
              <NumberField label="Z" value={s.z} onChange={(v) => set("z", v)} placeholder="0" className="max-w-14" />
            </Row>
          )}
        </Section>
      )}

      {parentLayout === "grid" && <GridItemSection s={s} set={set} ov={ov} cols={parent ? (effectiveStyle(parent, bp).columns ?? 3) : 3} />}
      {parentLayout === "stack" && s.position !== "absolute" && (
        <Section title="Căn riêng">
          {/* Khung cha xep doc -> con can theo chieu ngang, va nguoc lai */}
          {(() => {
            const axis = parent && effectiveStyle(parent, bp).direction === "row" ? "v" : "h";
            return (
              <Row label={axis === "h" ? "Căn ngang" : "Căn dọc"} {...ov("selfAlign")}>
                <Segmented value={s.selfAlign ?? "auto"} onChange={(v) => set("selfAlign", v === "auto" ? undefined : v)} options={selfAlignOptions(axis)} />
              </Row>
            );
          })()}
        </Section>
      )}
      <SpacingSection node={node} s={s} set={set} ov={ov} />

      {node.parent && (
        <Section title="Kích thước">
          <SizeRow label="Rộng" value={s.width} fallback={["image", "button", "icon", "logo", "cart", "account", "nav"].includes(node.type) ? "hug" : "fill"} onChange={(v) => set("width", v)} {...ov("width")} />
          <SizeRow label="Cao" value={s.height} fallback="hug" onChange={(v) => set("height", v)} {...ov("height")} />
          <Row label="Tỉ lệ khung" {...ov("aspectRatio")}>
            <Select
              value={s.aspectRatio ?? ""}
              onChange={(v) => set("aspectRatio", v || undefined)}
              options={[
                { value: "", label: "Tự do" },
                { value: "1 / 1", label: "1:1 vuông" },
                { value: "4 / 5", label: "4:5 dọc" },
                { value: "3 / 4", label: "3:4 dọc" },
                { value: "4 / 3", label: "4:3" },
                { value: "16 / 9", label: "16:9" },
                { value: "21 / 9", label: "21:9 banner" },
              ]}
            />
          </Row>
          <Row label="Rộng tối đa" {...ov("maxWidth")}>
            <NumberField value={s.maxWidth} onChange={(v) => set("maxWidth", v)} placeholder="—" step={10} />
          </Row>
          <Row label="Cao tối thiểu" {...ov("minHeight")}>
            <NumberField value={s.minHeight} onChange={(v) => set("minHeight", v)} placeholder="—" step={10} />
          </Row>
        </Section>
      )}

      {textLike && (
        <Section title={node.type === "icon" ? "Màu & cỡ icon" : "Chữ"}>
          {node.type !== "icon" && (
            <Row label="Font" {...ov("fontFamily")}>
              <Segmented
                value={s.fontFamily ?? "sans"}
                onChange={(v) => set("fontFamily", v)}
                options={[
                  { value: "sans", label: "Inter" },
                  { value: "display", label: <span className="font-serif">Fraunces</span> },
                ]}
              />
            </Row>
          )}
          <Row label={node.type === "icon" ? "Cỡ" : "Cỡ / đậm"} {...ov("fontSize")}>
            <NumberField value={s.fontSize} onChange={(v) => set("fontSize", v)} placeholder="14" min={8} />
            {node.type !== "icon" && (
              <Select value={s.fontWeight ?? 400} onChange={(v) => set("fontWeight", v)} options={[300, 400, 500, 600, 700, 800].map((w) => ({ value: w, label: String(w) }))} />
            )}
          </Row>
          {node.type === "text" && (
            <Row label="Dòng / giãn" {...ov("lineHeight")}>
              <NumberField label="↕" value={s.lineHeight} step={0.05} onChange={(v) => set("lineHeight", v)} placeholder="auto" />
              <NumberField label="↔" value={s.letterSpacing} step={0.1} min={-5} onChange={(v) => set("letterSpacing", v)} placeholder="0" />
            </Row>
          )}
          <Row label="Màu" {...ov("color")}>
            <ColorField value={s.color} onChange={(v) => set("color", v)} />
          </Row>
          {node.type !== "icon" && (
            <Row label="Canh" {...ov("textAlign")}>
              <Segmented
                value={s.textAlign ?? "left"}
                onChange={(v) => set("textAlign", v)}
                options={[
                  { value: "left", label: <AlignLeft className="size-3.5" /> },
                  { value: "center", label: <AlignCenter className="size-3.5" /> },
                  { value: "right", label: <AlignRight className="size-3.5" /> },
                ]}
              />
              <button
                type="button"
                title="Chữ in hoa"
                onClick={() => set("uppercase", !s.uppercase || undefined)}
                className={cn("grid size-7 shrink-0 place-items-center rounded-md bg-muted/70 text-muted-foreground", s.uppercase && "bg-[#0d99ff]/15 text-[#0d99ff]")}
              >
                <CaseUpper className="size-3.5" />
              </button>
            </Row>
          )}
        </Section>
      )}

      <AppearanceSection node={node} s={s} set={set} ov={ov} kind={kind} setProp={setProp} />
      {node.parent && <EffectSection node={node} s={s} set={set} ov={ov} setProp={setProp} />}

      {node.parent && (
        <Section title="Hiển thị">
          <Toggle checked={!!s.hidden} onChange={(v) => set("hidden", v || (bp === "base" ? undefined : false))} label={`Ẩn trên ${bpLabel}`} />
          {bp === "base" && <p className="text-[11px] text-muted-foreground">Ẩn ở Desktop sẽ ẩn mọi màn hình — chuyển sang Tablet / Mobile để ẩn riêng.</p>}
        </Section>
      )}
    </div>
  );
}

type SetStyle = <K extends keyof Style>(key: K, v: Style[K] | undefined) => void;
type Ov = (key: keyof Style) => { overridden: boolean; onReset: () => void };

function IconBtn({ children, title, onClick, danger }: { children: React.ReactNode; title: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn("grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted", danger && "hover:bg-destructive/10 hover:text-destructive")}
    >
      {children}
    </button>
  );
}

/* ------------------------------- Bo cuc ------------------------------- */

const LAYOUT_LABEL: Record<Layout, string> = { stack: "Xếp", grid: "Lưới", slider: "Slider", free: "Tự do" };

function LayoutSection({ node, s, set, ov }: { node: BuilderNode; s: Style; set: SetStyle; ov: Ov }) {
  const L = layoutOf(node, s)!;
  const modes: Layout[] = isContainer(node) ? ["stack", "grid", "slider", "free"] : node.type === "collection" ? ["stack", "grid", "slider"] : ["grid", "slider"];
  return (
    <Section title="Bố cục">
      <Row label="Kiểu xếp" {...ov("layout")}>
        <Segmented value={L} onChange={(v) => set("layout", v)} options={modes.map((m) => ({ value: m, label: LAYOUT_LABEL[m] }))} />
      </Row>
      {L === "stack" && (
        <>
          <Row label="Hướng" {...ov("direction")}>
            <Segmented
              value={s.direction ?? "column"}
              onChange={(v) => set("direction", v)}
              options={[
                { value: "column", label: <ArrowDown className="size-3.5" />, title: "Dọc" },
                { value: "row", label: <ArrowRight className="size-3.5" />, title: "Ngang" },
              ]}
            />
            <button
              type="button"
              title="Tự xuống dòng"
              onClick={() => set("wrap", !s.wrap)}
              className={cn("grid size-7 shrink-0 place-items-center rounded-md bg-muted/70 text-muted-foreground", s.wrap && "bg-[#0d99ff]/15 text-[#0d99ff]")}
            >
              <WrapText className="size-3.5" />
            </button>
          </Row>
          <div className="grid grid-cols-[72px_1fr] gap-2">
            <span className="pt-1 text-[11px] text-muted-foreground">Căn</span>
            <div className="flex items-start gap-2">
              <AlignPad
                direction={s.direction ?? "column"}
                justify={s.justify ?? "start"}
                align={s.align ?? "start"}
                onChange={(j, a) => {
                  if (s.justify !== "between") set("justify", j);
                  set("align", a);
                }}
              />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <NumberField label="Gap" value={s.gap} onChange={(v) => set("gap", v)} placeholder="0" />
                <button
                  type="button"
                  onClick={() => set("justify", s.justify === "between" ? "start" : "between")}
                  className={cn("flex h-7 items-center justify-center gap-1 rounded-md bg-muted/70 text-[11px] text-muted-foreground", s.justify === "between" && "bg-[#0d99ff]/15 text-[#0d99ff]")}
                >
                  <AlignHorizontalSpaceBetween className="size-3.5" /> Dàn đều
                </button>
                <button
                  type="button"
                  onClick={() => set("align", s.align === "stretch" ? "start" : "stretch")}
                  className={cn("h-7 rounded-md bg-muted/70 text-[11px] text-muted-foreground", s.align === "stretch" && "bg-[#0d99ff]/15 text-[#0d99ff]")}
                >
                  Con giãn hết bề ngang
                </button>
              </div>
            </div>
          </div>
        </>
      )}
      {L === "grid" && (
        <>
          <Row label="Số cột" {...ov("columns")}>
            <NumberField value={s.columns ?? 3} min={1} max={12} onChange={(v) => set("columns", v)} />
          </Row>
          <Row label="Khoảng cách" {...ov("gap")}>
            <NumberField value={s.gap ?? 16} onChange={(v) => set("gap", v)} />
          </Row>
          <Row label="Hiện tối đa" {...ov("maxItems")}>
            <NumberField value={s.maxItems} min={1} onChange={(v) => set("maxItems", v)} placeholder="Tất cả" />
          </Row>
          <Row label="Cao mỗi hàng" {...ov("rowHeight")}>
            <NumberField value={s.rowHeight} onChange={(v) => set("rowHeight", v)} placeholder="Tự động" step={10} />
          </Row>
          <Row label="Ô đầu nổi bật" {...ov("firstColSpan")}>
            <NumberField label="cột" value={s.firstColSpan ?? 1} min={1} max={12} onChange={(v) => set("firstColSpan", v && v > 1 ? v : undefined)} />
            <NumberField label="hàng" value={s.firstRowSpan ?? 1} min={1} max={12} onChange={(v) => set("firstRowSpan", v && v > 1 ? v : undefined)} />
          </Row>
          <p className="text-[11px] leading-relaxed text-muted-foreground">Mẹo: chọn từng ô để cho nó chiếm nhiều cột / hàng (kiểu bento), hoặc kéo tay cầm ngang của ô.</p>
        </>
      )}
      {L === "slider" && (
        <>
          <Row label="Số item / lần" {...ov("perView")}>
            <NumberField value={s.perView ?? defaultPerView(node)} min={1} max={12} step={0.5} onChange={(v) => set("perView", v)} />
          </Row>
          <Row label="Khoảng cách" {...ov("gap")}>
            <NumberField value={s.gap ?? 16} onChange={(v) => set("gap", v)} />
          </Row>
          <Row label="Hé item sau" {...ov("peek")}>
            <NumberField value={s.peek} onChange={(v) => set("peek", v)} placeholder="0 px" />
          </Row>
        </>
      )}
      {L === "free" && <p className="text-[11px] leading-relaxed text-muted-foreground">Kéo các khối con tới bất kỳ chỗ nào trong khung. Chỉnh chiều cao khung ở “Cao tối thiểu”.</p>}
      {(node.type === "section" || node.type === "page") && (
        <Row label="Rộng nội dung" {...ov("contentWidth")}>
          <NumberField value={s.contentWidth} onChange={(v) => set("contentWidth", v)} placeholder="Tràn" step={10} />
        </Row>
      )}
    </Section>
  );
}

function SliderSection({ opts, onChange }: { opts: SliderOpts; onChange: (o: SliderOpts) => void }) {
  const put = (patch: Partial<SliderOpts>) => onChange({ ...opts, ...patch });
  return (
    <Section title="Slider">
      <Row label="Chuyển cảnh">
        <Segmented
          value={opts.effect ?? "slide"}
          onChange={(v) => put({ effect: v })}
          options={[
            { value: "slide", label: "Trượt" },
            { value: "fade", label: "Mờ dần" },
          ]}
        />
      </Row>
      {opts.effect === "fade" && <p className="text-[11px] text-muted-foreground">Mờ dần hiện 1 slide mỗi lần (bỏ qua “Số item / lần”).</p>}
      <Row label="Mũi tên">
        <Toggle checked={opts.arrows !== false} onChange={(v) => put({ arrows: v })} label="" />
        <span className="text-[11px] text-muted-foreground">Lặp vòng</span>
        <Toggle checked={opts.loop !== false} onChange={(v) => put({ loop: v })} label="" />
      </Row>
      <Row label="Chấm">
        <Segmented
          value={opts.dots ?? "below"}
          onChange={(v) => put({ dots: v })}
          options={[
            { value: "none", label: "Ẩn" },
            { value: "below", label: "Bên dưới" },
            { value: "inside", label: "Trên ảnh" },
          ]}
        />
      </Row>
      <Row label="Tự chạy">
        <Toggle checked={!!opts.autoplay} onChange={(v) => put({ autoplay: v })} label="" />
        {opts.autoplay && <NumberField label="s" value={(opts.interval ?? 4000) / 1000} min={1.5} step={0.5} onChange={(v) => put({ interval: (v ?? 4) * 1000 })} />}
      </Row>
      {opts.autoplay && <p className="text-[11px] text-muted-foreground">Trong trình dựng slider không tự chạy; xem ở “Xem trước”.</p>}
    </Section>
  );
}

/* ------------------------------- Du lieu ------------------------------- */

/** Gan khung voi MOT ban ghi (san pham / bai viet / danh muc): chu ben trong dung {{truong}} cua no. */
function BindSection({ node, setProp, kind }: { node: BuilderNode; setProp: (p: Partial<NodeProps>) => void; kind: RecordKind | null }) {
  const b = node.props.bind;
  const [open, setOpen] = useState(!!b);
  const inherited = kind && !b;
  return (
    <Section
      title="Gắn dữ liệu"
      actions={
        !b && (
          <button type="button" onClick={() => setOpen(!open)} className="text-[11px] text-[#0d99ff] hover:underline">
            {open ? "Đóng" : "Gắn bản ghi"}
          </button>
        )
      }
    >
      {inherited && !open && <p className="text-[11px] text-muted-foreground">Đang dùng dữ liệu {KIND_LABEL[kind].toLowerCase()} của khung cha.</p>}
      {!inherited && !open && <p className="text-[11px] text-muted-foreground">Gắn khung này với một sản phẩm / bài viết / danh mục để chữ, ảnh, link bên trong tự lấy theo.</p>}
      {open && (
        <>
          <Row label="Loại">
            <Segmented
              value={b?.kind ?? "products"}
              onChange={(k) => setProp({ bind: { kind: k, id: 0 } })}
              options={(["products", "posts", "categories"] as RecordKind[]).map((k) => ({ value: k, label: KIND_LABEL[k] }))}
            />
          </Row>
          <RecordPicker kind={b?.kind ?? "products"} ids={b?.id ? [b.id] : []} single onChange={(ids) => setProp({ bind: ids[0] ? { kind: b?.kind ?? "products", id: ids[0] } : undefined })} />
          {b && (
            <button type="button" onClick={() => (setProp({ bind: undefined }), setOpen(false))} className="text-[11px] text-destructive hover:underline">
              Bỏ gắn dữ liệu
            </button>
          )}
        </>
      )}
    </Section>
  );
}

/** Nut chen {{truong}} vao o chu dang sua. */
function FieldChips({ kind, onInsert }: { kind: RecordKind; onInsert: (token: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      <Database className="mt-1 size-3 text-[#0d99ff]" />
      {RECORD_FIELDS[kind]
        .filter((f) => f.key !== "image")
        .map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => onInsert(`{{${f.key}}}`)}
            className="rounded-full border border-[#0d99ff]/40 bg-[#0d99ff]/8 px-2 py-0.5 text-[10px] text-[#0a6fbf] hover:bg-[#0d99ff]/15"
          >
            {f.label}
          </button>
        ))}
    </div>
  );
}

const append = (v: string | undefined, token: string) => `${v ?? ""}${v && !v.endsWith(" ") ? " " : ""}${token}`;

function ProductSourceFields({ p, setProp, catalogues }: { p: NodeProps; setProp: (patch: Partial<NodeProps>) => void; catalogues: CatalogueOption[] }) {
  // Nguon theo trang dang xem chi co nghia trong template: "listing" o trang danh muc, "related" o trang SP / danh muc
  const pageKind = useEditor((s) => s.page.kind);
  const allowed = (k: string) =>
    (k !== "christmas" || p.source === "christmas") &&
    (k !== "listing" || pageKind === "catalogue" || p.source === "listing") &&
    (k !== "related" || pageKind === "product" || pageKind === "catalogue" || p.source === "related");
  return (
    <>
      <Row label="Nguồn">
        <Select
          value={p.source ?? "bestsellers"}
          onChange={(v) => setProp({ source: v as ProductSource })}
          // "christmas" la nguon rieng cua ban dau, chi con hien khi khoi cu dang dung
          options={Object.entries(SOURCE_LABEL)
            .filter(([k]) => allowed(k))
            .map(([value, label]) => ({ value: value as ProductSource, label }))}
        />
      </Row>
      {p.source === "catalogue" && (
        <Row label="Danh mục">
          <Select
            value={p.catalogueId}
            onChange={(v) => setProp({ catalogueId: v })}
            options={catalogues.map((c) => ({ value: c.id, label: `${"— ".repeat(Math.max(0, (c.level ?? 1) - 1))}${c.name} (${c.count})` }))}
          />
        </Row>
      )}
      {p.source === "keyword" && (
        <Row label="Từ khóa">
          <TextField value={p.keyword} onChange={(v) => setProp({ keyword: v })} placeholder="gift, sale…" />
        </Row>
      )}
      {p.source === "listing" ? (
        <p className="text-[11px] leading-relaxed text-muted-foreground">Sản phẩm của danh mục đang xem, theo bộ lọc / sắp xếp / trang khách đang chọn (16 sản phẩm mỗi trang).</p>
      ) : p.source === "manual" ? (
        <RecordPicker kind="products" ids={p.productIds ?? []} onChange={(productIds) => setProp({ productIds })} />
      ) : (
        <Row label="Số lượng">
          <NumberField value={p.limit ?? 12} min={1} max={48} onChange={(v) => setProp({ limit: v ?? 12 })} />
        </Row>
      )}
    </>
  );
}

function CatalogueSourceFields({ p, setProp }: { p: NodeProps; setProp: (patch: Partial<NodeProps>) => void }) {
  return (
    <>
      <Row label="Danh mục">
        <Segmented
          value={p.catSource ?? "top"}
          onChange={(v) => setProp({ catSource: v })}
          options={[
            { value: "top", label: "Cấp 1" },
            { value: "all", label: "Tất cả" },
            { value: "manual", label: "Chọn tay" },
          ]}
        />
      </Row>
      {p.catSource === "manual" ? (
        <RecordPicker kind="categories" ids={p.catalogueIds ?? []} onChange={(catalogueIds) => setProp({ catalogueIds })} />
      ) : (
        <Row label="Số lượng">
          <NumberField value={p.limit ?? 12} min={1} max={48} onChange={(v) => setProp({ limit: v ?? 12 })} />
        </Row>
      )}
    </>
  );
}

function ContentSection({
  node,
  setProp,
  catalogues,
  kind,
  imageAdjust,
}: {
  node: BuilderNode;
  setProp: (p: Partial<NodeProps>) => void;
  catalogues: CatalogueOption[];
  kind: RecordKind | null;
  imageAdjust?: { value: ImageAdjust | undefined; onChange: (v: ImageAdjust | undefined) => void };
}) {
  const store = useStore();
  const [picker, setPicker] = useState(false);
  const p = node.props;
  switch (node.type) {
    case "slot": {
      const def = p.slot ? SLOTS[p.slot] : undefined;
      const designs = p.slot ? SLOT_DESIGNS[p.slot] : undefined;
      if (!def) return null;
      return (
        <Section title={def.label}>
          <p className="text-[11px] leading-relaxed text-muted-foreground">{def.hint}. Nền, viền, khoảng cách, chữ: chỉnh ở các mục bên dưới.</p>
          {designs && (
            <div className="grid grid-cols-2 gap-1">
              {designs.options.map((o, i) => {
                const on = (p.design ?? designs.options[0].key) === o.key;
                return (
                  <button
                    key={o.key}
                    type="button"
                    onClick={() => setProp({ design: i === 0 ? undefined : o.key })}
                    className={cn(
                      "min-h-8 rounded-md border bg-white px-2 py-1 text-left text-[11px] leading-tight transition-colors hover:border-[#0d99ff]/60",
                      on && "border-[#0d99ff] bg-[#0d99ff]/5 font-semibold text-[#0a6fbf] ring-2 ring-[#0d99ff]/15",
                    )}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
          )}
          {designs?.gallery && (
            <>
              {p.design !== "none" && (
                <>
                  <Row label="Số ảnh nhỏ">
                    <NumberField value={p.limit ?? 0} min={0} max={20} onChange={(v) => setProp({ limit: v || undefined })} />
                    <span className="shrink-0 text-[11px] text-muted-foreground">{p.limit ? "ảnh, còn lại cuộn" : "0 = theo ảnh lớn"}</span>
                  </Row>
                  <Row label="Cỡ ảnh nhỏ">
                    <NumberField value={p.thumbSize ?? 52} min={32} max={120} onChange={(v) => setProp({ thumbSize: v && v !== 52 ? v : undefined })} />
                    <span className="shrink-0 text-[11px] text-muted-foreground">px</span>
                  </Row>
                </>
              )}
              <Toggle checked={!p.noZoom} onChange={(v) => setProp({ noZoom: v ? undefined : true })} label="Phóng to khi rê chuột vào ảnh" />
              <p className="text-[11px] leading-relaxed text-muted-foreground">Trên điện thoại, ảnh nhỏ dọc tự chuyển thành hàng ngang bên dưới.</p>
            </>
          )}
          {designs?.label !== undefined && (
            <Row label="Chữ">
              <TextField value={p.label} onChange={(v) => setProp({ label: v || undefined })} placeholder={designs.label} />
            </Row>
          )}
          {designs?.heading && (
            <>
              <Row label="Tiêu đề">
                <TextField value={p.heading} onChange={(v) => setProp({ heading: v || undefined })} placeholder="Mặc định" />
              </Row>
              <Toggle checked={!!p.hideHeading} onChange={(v) => setProp({ hideHeading: v || undefined })} label="Ẩn tiêu đề" />
              <Toggle checked={!!p.collapsible} onChange={(v) => setProp({ collapsible: v || undefined })} label="Cho khách thu gọn / mở ra" />
            </>
          )}
        </Section>
      );
    }
    case "text":
      return (
        <Section title="Nội dung">
          <Row label="Thẻ">
            <Segmented value={p.tag ?? "p"} onChange={(v) => setProp({ tag: v })} options={(["h1", "h2", "h3", "h4", "p"] as const).map((t) => ({ value: t, label: t.toUpperCase() }))} />
          </Row>
          <TextField multiline value={p.text} onChange={(v) => setProp({ text: v })} />
          {kind ? (
            <FieldChips kind={kind} onInsert={(t) => setProp({ text: append(p.text, t) })} />
          ) : (
            <p className="text-[11px] text-muted-foreground">Mẹo: nhấp đúp vào chữ trên canvas để sửa trực tiếp.</p>
          )}
        </Section>
      );
    case "image":
      return (
        <Section title="Ảnh">
          {kind && <Toggle checked={!!p.bindImage} onChange={(v) => setProp({ bindImage: v })} label={`Lấy ảnh của ${KIND_LABEL[kind].toLowerCase()}`} />}
          {!p.bindImage && (
            <>
              {p.src && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.src} alt="" className="h-28 w-full rounded-md border bg-muted object-contain" />
              )}
              <button type="button" onClick={() => setPicker(true)} className="flex h-8 w-full items-center justify-center gap-1.5 rounded-md border text-xs font-medium hover:bg-muted">
                <ImagePlus className="size-3.5" /> Chọn ảnh từ thư viện
              </button>
              <Row label="Đường dẫn">
                <TextField value={p.src} onChange={(v) => setProp({ src: v })} />
              </Row>
            </>
          )}
          <Row label="Alt">
            <TextField value={p.alt} onChange={(v) => setProp({ alt: v })} placeholder="Mô tả ảnh (SEO)" />
          </Row>
          <Row label="Cách lấp">
            <Segmented
              value={p.fit ?? "cover"}
              onChange={(v) => setProp({ fit: v })}
              options={[
                { value: "cover", label: "Phủ kín (crop)" },
                { value: "contain", label: "Vừa khung" },
              ]}
            />
          </Row>
          <button type="button" onClick={() => startCrop(store, node.id)} className="flex h-7 w-full items-center justify-center gap-1.5 rounded-md bg-muted/70 text-[11px] hover:bg-muted">
            <Crop className="size-3.5" /> Crop: kéo ảnh trên canvas để chọn vùng hiển thị
          </button>
          {imageAdjust && <AdjustSliders value={imageAdjust.value} onChange={imageAdjust.onChange} />}
          <MediaPicker open={picker} onOpenChange={setPicker} onSelect={(urls) => urls[0] && setProp({ src: urls[0] })} />
        </Section>
      );
    case "button":
      return (
        <Section title="Nút / liên kết">
          <Row label="Chữ">
            <TextField value={p.label} onChange={(v) => setProp({ label: v })} />
          </Row>
          <Row label="Liên kết">
            <TextField value={p.href} onChange={(v) => setProp({ href: v })} placeholder="/products.html" />
          </Row>
          {kind && <FieldChips kind={kind} onInsert={(t) => setProp({ label: append(p.label, t) })} />}
          {kind && (
            <button type="button" onClick={() => setProp({ href: "{{url}}" })} className="text-[11px] text-[#0d99ff] hover:underline">
              Liên kết tới {KIND_LABEL[kind].toLowerCase()} này
            </button>
          )}
          <Toggle checked={!!p.newTab} onChange={(v) => setProp({ newTab: v || undefined })} label="Mở tab mới" />
        </Section>
      );
    case "icon":
      return (
        <Section title="Icon">
          <IconPicker value={p.icon} onChange={(icon) => setProp({ icon })} />
        </Section>
      );
    case "video":
      return (
        <Section title="Video">
          <TextField value={p.url} onChange={(v) => setProp({ url: v })} placeholder="https://youtube.com/watch?v=…" />
          <p className="text-[11px] text-muted-foreground">YouTube, Vimeo hoặc link file .mp4. Tỉ lệ mặc định 16:9.</p>
        </Section>
      );
    case "logo":
      return (
        <Section title="Logo">
          {p.src && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.src} alt="" className="h-16 w-full rounded-md border bg-muted object-contain" />
          )}
          <button type="button" onClick={() => setPicker(true)} className="flex h-8 w-full items-center justify-center gap-1.5 rounded-md border text-xs font-medium hover:bg-muted">
            <ImagePlus className="size-3.5" /> {p.src ? "Đổi ảnh logo" : "Chọn ảnh logo"}
          </button>
          {p.src && (
            <button type="button" onClick={() => setProp({ src: undefined })} className="text-[11px] text-muted-foreground hover:underline">
              Dùng logo có sẵn của website
            </button>
          )}
          <MediaPicker open={picker} onOpenChange={setPicker} onSelect={(urls) => urls[0] && setProp({ src: urls[0] })} />
          <p className="text-[11px] text-muted-foreground">Chưa chọn ảnh thì dùng logo có sẵn của website. Cỡ logo chỉnh ở “Kích thước”.</p>
          <Row label="Nền">
            <Segmented
              value={p.tone ?? "light"}
              onChange={(v) => setProp({ tone: v })}
              options={[
                { value: "light", label: "Nền tối" },
                { value: "dark", label: "Nền sáng" },
              ]}
            />
          </Row>
        </Section>
      );
    case "search":
      return (
        <Section title="Ô tìm kiếm">
          <Row label="Gợi ý">
            <TextField value={p.placeholder} onChange={(v) => setProp({ placeholder: v })} />
          </Row>
        </Section>
      );
    case "cart":
    case "account":
      return (
        <Section title={TYPE_LABEL[node.type]}>
          <Row label="Nhãn">
            <TextField value={p.label} onChange={(v) => setProp({ label: v })} placeholder={node.type === "cart" ? "Cart" : "Sign in"} />
          </Row>
          <p className="text-[11px] text-muted-foreground">{node.type === "cart" ? "Số lượng giỏ hàng tự cập nhật." : "Khách đã đăng nhập sẽ thấy “Hi, tên”."}</p>
        </Section>
      );
    case "nav":
      return (
        <Section title="Menu">
          <LinksEditor value={p.links ?? []} onChange={(links) => setProp({ links })} />
          <Toggle checked={!!p.withCategories} onChange={(v) => setProp({ withCategories: v })} label="Chèn danh mục sản phẩm (sau liên kết đầu)" />
          <Row label="Nút ☰ từ">
            <Segmented
              value={p.collapse ?? "mobile"}
              onChange={(v) => setProp({ collapse: v })}
              options={[
                { value: "tablet", label: "Tablet" },
                { value: "mobile", label: "Mobile" },
                { value: "never", label: "Không" },
              ]}
            />
          </Row>
        </Section>
      );
    case "productRow":
    case "productGrid": {
      const custom = isProducts(node);
      return (
        <Section title="Khối sản phẩm">
          <ConvertBox node={node} />
          {node.type === "productRow" && (
            <Row label="Giao diện">
              <Segmented
                value={p.display ?? "amazon"}
                onChange={(v) => setProp({ display: v })}
                options={[
                  { value: "amazon", label: "Kiểu Amazon" },
                  { value: "custom", label: "Tùy chỉnh" },
                ]}
              />
            </Row>
          )}
          {!custom && <p className="text-[11px] text-muted-foreground">Kiểu Amazon có sẵn. Chọn “Tùy chỉnh” để chọn lưới / slider, số item mỗi lần, kiểu thẻ.</p>}
          <Row label="Tiêu đề">
            <TextField value={p.title} onChange={(v) => setProp({ title: v })} />
          </Row>
          <Row label="Link xem thêm">
            <TextField value={p.href} onChange={(v) => setProp({ href: v })} placeholder="/products.html" />
          </Row>
          <ProductSourceFields p={p} setProp={setProp} catalogues={catalogues} />
          {custom && (
            <>
              <Row label="Tiêu đề canh">
                <Segmented
                  value={p.titleAlign ?? "left"}
                  onChange={(v) => setProp({ titleAlign: v })}
                  options={[
                    { value: "left", label: "Trái" },
                    { value: "center", label: "Giữa" },
                  ]}
                />
              </Row>
              <Row label="Kiểu thẻ">
                <Segmented
                  value={p.cardStyle ?? "plain"}
                  onChange={(v) => setProp({ cardStyle: v })}
                  options={[
                    { value: "plain", label: "Trơn" },
                    { value: "boxed", label: "Có khung" },
                  ]}
                />
              </Row>
              <Row label="Ảnh thẻ">
                <Select
                  value={p.cardRatio ?? "1 / 1"}
                  onChange={(v) => setProp({ cardRatio: v })}
                  options={[
                    { value: "1 / 1", label: "Vuông 1:1" },
                    { value: "4 / 5", label: "Dọc 4:5" },
                    { value: "3 / 4", label: "Dọc 3:4" },
                    { value: "4 / 3", label: "Ngang 4:3" },
                  ]}
                />
              </Row>
              <Row label="Hiện">
                <Toggle checked={p.showPrice !== false} onChange={(v) => setProp({ showPrice: v })} label="Giá" />
                <Toggle checked={p.showRating !== false} onChange={(v) => setProp({ showRating: v })} label="Sao" />
              </Row>
            </>
          )}
        </Section>
      );
    }
    case "categoryHero":
      return (
        <Section title="Thẻ danh mục lớn">
          <p className="text-[11px] leading-relaxed text-muted-foreground">Tên, mô tả, ảnh, số sản phẩm lấy từ danh mục trong database.</p>
          <CatalogueSourceFields p={{ limit: 3, ...p }} setProp={setProp} />
          <ConvertBox node={node} />
        </Section>
      );
    case "collection": {
      const k = p.collection ?? "categories";
      const pageKind = store.state.page.kind;
      return (
        <Section title="Danh sách dữ liệu">
          <Row label="Lặp theo">
            <Segmented
              value={k}
              onChange={(v) => setProp({ collection: v, source: v === "products" ? (p.source ?? "newest") : p.source })}
              options={(["categories", "products", "posts"] as RecordKind[]).map((x) => ({ value: x, label: KIND_LABEL[x] }))}
            />
          </Row>
          {k === "categories" && <CatalogueSourceFields p={p} setProp={setProp} />}
          {k === "products" && <ProductSourceFields p={p} setProp={setProp} catalogues={catalogues} />}
          {k === "posts" && (
            <>
              <Row label="Bài viết">
                <Select
                  value={p.source === "manual" || p.source === "listing" || p.source === "related" ? p.source : "newest"}
                  onChange={(v) => setProp({ source: v as ProductSource })}
                  options={[
                    { value: "newest", label: "Mới nhất" },
                    { value: "manual", label: "Chọn tay" },
                    ...(pageKind === "postcat" || p.source === "listing" ? [{ value: "listing", label: "Danh sách của trang đang xem" }] : []),
                    ...(pageKind === "post" || p.source === "related" ? [{ value: "related", label: "Cùng danh mục với bài đang xem" }] : []),
                  ]}
                />
              </Row>
              {p.source === "listing" ? (
                <p className="text-[11px] text-muted-foreground">Bài của danh mục đang xem theo trang số (15 bài mỗi trang) — thêm khối Phân trang bên dưới.</p>
              ) : p.source === "manual" ? (
                <RecordPicker kind="posts" ids={p.productIds ?? []} onChange={(productIds) => setProp({ productIds })} />
              ) : (
                <Row label="Số lượng">
                  <NumberField value={p.limit ?? 6} min={1} max={48} onChange={(v) => setProp({ limit: v ?? 6 })} />
                </Row>
              )}
            </>
          )}
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Khối con đầu tiên là <b>thẻ mẫu</b>: sửa nó (chữ, ảnh, màu, bố cục) thì mọi thẻ đổi theo. Trong chữ dùng nút xanh để chèn tên, giá…
          </p>
          {!node.children?.length && (
            <button
              type="button"
              onClick={() => store.insertSpec({ type: "frame", name: "Thẻ mẫu", props: { href: "{{url}}" }, style: { base: { direction: "column", gap: 8 } } }, node.id, 0)}
              className="h-7 w-full rounded-md border border-dashed text-[11px] hover:bg-muted"
            >
              Tạo thẻ mẫu
            </button>
          )}
        </Section>
      );
    }
    case "frame":
    case "section":
      return (
        <Section title="Liên kết khung">
          <Row label="Link">
            <TextField value={p.href} onChange={(v) => setProp({ href: v || undefined })} placeholder="Bấm cả khung để mở link" />
          </Row>
          {kind && (
            <button type="button" onClick={() => setProp({ href: "{{url}}" })} className="text-[11px] text-[#0d99ff] hover:underline">
              Liên kết tới {KIND_LABEL[kind].toLowerCase()} này
            </button>
          )}
          {p.href && <Toggle checked={!!p.newTab} onChange={(v) => setProp({ newTab: v || undefined })} label="Mở tab mới" />}
        </Section>
      );
    default:
      return null;
  }
}

/* ------------------------------- Giao dien ------------------------------- */

function AppearanceSection({ node, s, set, ov, kind, setProp }: { node: BuilderNode; s: Style; set: SetStyle; ov: Ov; kind: RecordKind | null; setProp: (p: Partial<NodeProps>) => void }) {
  const store = useStore();
  const [picker, setPicker] = useState(false);
  const container = isContainer(node);
  return (
    <Section title="Giao diện">
      <Row label="Nền" {...ov("background")}>
        <ColorField value={s.background} onChange={(v) => set("background", v)} />
      </Row>
      {container && kind && <Toggle checked={!!node.props.bindBg} onChange={(v) => setProp({ bindBg: v || undefined })} label="Màu nền xoay vòng theo dữ liệu" />}
      {container && (
        <>
          <BgImagePanel node={node} s={s} set={set} ov={ov} />
        </>
      )}
      <Row label="Bo góc" {...ov("radius")}>
        <NumberField value={s.radius} onChange={(v) => set("radius", v)} placeholder="0" />
      </Row>
      <Row label="Viền" {...ov("borderWidth")}>
        <NumberField value={s.borderWidth} onChange={(v) => set("borderWidth", v)} placeholder="0" className="max-w-16" />
        <ColorField value={s.borderColor} onChange={(v) => set("borderColor", v)} />
      </Row>
      <Row label="Đổ bóng" {...ov("shadow")}>
        <Segmented
          value={s.shadow ?? "none"}
          onChange={(v) => set("shadow", v)}
          options={[
            { value: "none", label: "—" },
            { value: "sm", label: "S" },
            { value: "md", label: "M" },
            { value: "lg", label: "L" },
          ]}
        />
      </Row>
      <Row label="Mờ (%)" {...ov("opacity")}>
        <NumberField value={s.opacity === undefined ? 100 : Math.round(s.opacity * 100)} max={100} onChange={(v) => set("opacity", v === undefined || v >= 100 ? undefined : v / 100)} />
      </Row>
    </Section>
  );
}

function EffectSection({ node, s, set, ov, setProp }: { node: BuilderNode; s: Style; set: SetStyle; ov: Ov; setProp: (p: Partial<NodeProps>) => void }) {
  const store = useStore();
  const a = node.props.anim ?? { type: "none" as AnimType };
  const put = (patch: Partial<typeof a>) => setProp({ anim: { ...a, ...patch } });
  const group = isContainer(node) || node.type === "collection" || isProducts(node);
  const replay = () => {
    const idoc = store.iframe?.contentDocument;
    const root = idoc?.querySelector<HTMLElement>(`[data-node-id="${node.id}"]`);
    if (!root) return;
    const els = [root, ...root.querySelectorAll<HTMLElement>("[data-anim]")].filter((el) => el.hasAttribute("data-anim"));
    els.forEach((el) => el.classList.remove("bb-in"));
    void root.offsetWidth;
    els.forEach((el) => el.classList.add("bb-in"));
  };
  return (
    <Section
      title="Hiệu ứng"
      actions={
        a.type !== "none" && (
          <button type="button" onClick={replay} className="flex items-center gap-1 text-[11px] text-[#0d99ff] hover:underline">
            <Play className="size-3" /> Xem thử
          </button>
        )
      }
    >
      <Row label="Xuất hiện">
        <Select value={a.type} onChange={(v) => put({ type: v })} options={(Object.keys(ANIM_LABEL) as AnimType[]).map((k) => ({ value: k, label: ANIM_LABEL[k] }))} />
      </Row>
      {a.type !== "none" && (
        <>
          <Row label="Thời gian / trễ">
            <NumberField label="ms" value={a.duration ?? 700} min={100} step={50} onChange={(v) => put({ duration: v })} />
            <NumberField label="+" value={a.delay ?? 0} step={50} onChange={(v) => put({ delay: v })} />
          </Row>
          {group && (
            <Row label="Lần lượt">
              <Toggle checked={!!a.stagger} onChange={(v) => put({ stagger: v ? 120 : undefined })} label="" />
              {!!a.stagger && <NumberField label="ms" value={a.stagger} min={20} step={10} onChange={(v) => put({ stagger: v })} />}
            </Row>
          )}
          {group && <p className="text-[11px] text-muted-foreground">“Lần lượt”: từng khối con hiện nối tiếp nhau thay vì cả khung cùng lúc.</p>}
        </>
      )}
      <Row label="Khi rê chuột" {...ov("hover")}>
        <Select value={s.hover ?? "none"} onChange={(v) => set("hover", v as Hover)} options={(Object.keys(HOVER_LABEL) as Hover[]).map((k) => ({ value: k, label: HOVER_LABEL[k] }))} />
      </Row>
    </Section>
  );
}

function SizeRow({
  label,
  value,
  fallback,
  onChange,
  overridden,
  onReset,
}: {
  label: string;
  value: Size | undefined;
  fallback: Size["mode"];
  onChange: (v: Size) => void;
  overridden?: boolean;
  onReset?: () => void;
}) {
  const mode = value?.mode ?? fallback;
  return (
    <Row label={label} overridden={overridden} onReset={onReset}>
      <Segmented
        value={mode}
        onChange={(m) => onChange(m === "fixed" ? { mode: m, value: value?.value ?? 320 } : { mode: m })}
        options={[
          { value: "fill", label: "Fill", title: "Giãn hết chỗ trống" },
          { value: "hug", label: "Hug", title: "Vừa nội dung" },
          { value: "fixed", label: "Fixed", title: "Cố định (px)" },
        ]}
      />
      {mode === "fixed" && <NumberField value={value?.value} onChange={(v) => onChange({ mode: "fixed", value: v ?? 0 })} className="max-w-16" />}
    </Row>
  );
}

function PaddingField({
  value,
  onChange,
  overridden,
  onReset,
  label = "Padding",
  min = 0,
}: {
  value: Style["padding"];
  onChange: (v: Style["padding"]) => void;
  overridden?: boolean;
  onReset?: () => void;
  label?: string;
  min?: number;
}) {
  const p = value ?? [0, 0, 0, 0];
  const [split, setSplit] = useState(p[0] !== p[2] || p[1] !== p[3]);
  const put = (i: number[], v: number | undefined) => {
    const n = [...p] as [number, number, number, number];
    i.forEach((k) => (n[k] = v ?? 0));
    onChange(n.every((x) => !x) ? undefined : n);
  };
  return (
    <Row label={label} overridden={overridden} onReset={onReset}>
      {split ? (
        <div className="grid flex-1 grid-cols-4 gap-1">
          {(["↑", "→", "↓", "←"] as const).map((l, i) => (
            <NumberField key={l} label={l} value={p[i]} min={min} onChange={(v) => put([i], v)} />
          ))}
        </div>
      ) : (
        <>
          <NumberField label="↔" value={p[1]} min={min} onChange={(v) => put([1, 3], v)} />
          <NumberField label="↕" value={p[0]} min={min} onChange={(v) => put([0, 2], v)} />
        </>
      )}
      <button type="button" title={split ? "Gộp" : "Tách 4 cạnh"} onClick={() => setSplit(!split)} className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted">
        {split ? <Link2 className="size-3.5" /> : <Unlink2 className="size-3.5" />}
      </button>
    </Row>
  );
}

/** Thu vien kieu the: bam de doi kieu cho "Danh sách dữ liệu" (giu nguon du lieu, ap bo cuc goi y). */
function DesignGallery({ node }: { node: BuilderNode }) {
  const store = useStore();
  const kind = node.props.collection ?? "categories";
  return (
    <Section title="Kiểu thẻ (thư viện mẫu)">
      <div className="grid grid-cols-2 gap-1.5">
        {CARD_DESIGNS[kind].map((d) => (
          <button
            key={d.key}
            type="button"
            title={d.hint}
            onClick={() => store.setDesign(node.id, d.card(), d.layout(), { design: d.key, ...(d.props ?? {}) })}
            className={cn(
              "rounded-lg border bg-white p-1 text-left transition-colors hover:border-[#0d99ff]/60",
              node.props.design === d.key && "border-[#0d99ff] ring-2 ring-[#0d99ff]/20",
            )}
          >
            <DesignThumb id={`${kind}:${d.key}`} />
            <div className="truncate px-0.5 pt-1 text-[10px] font-medium">{d.label}</div>
          </button>
        ))}
      </div>
      <p className="text-[11px] leading-relaxed text-muted-foreground">Đổi kiểu sẽ thay thẻ mẫu và bố cục; nguồn dữ liệu giữ nguyên. Sau đó vẫn sửa từng chữ, màu, ảnh trong thẻ mẫu được (Ctrl+Z để quay lại).</p>
    </Section>
  );
}

/** Khoi co dinh (the danh muc lon, hang kieu Amazon): nut chuyen sang "Danh sách dữ liệu" de doi kieu / sua tung chi tiet. */
function ConvertBox({ node }: { node: BuilderNode }) {
  const store = useStore();
  const spec = customizableSpec(node);
  if (!spec) return null;
  return (
    <div className="rounded-lg border border-[#0d99ff]/30 bg-[#0d99ff]/5 p-2.5">
      <p className="text-[11px] leading-relaxed text-[#0a6fbf]">Khối này có kiểu cố định. Chuyển sang dạng tùy biến để chọn kiểu khác trong thư viện mẫu và sửa từng chi tiết của thẻ.</p>
      <button
        type="button"
        onClick={() => store.replaceWith(node.id, spec)}
        className="mt-2 h-7 w-full rounded-md bg-[#0d99ff] text-[11px] font-semibold text-white hover:bg-[#0b87e0]"
      >
        Chuyển sang dạng tùy biến
      </button>
    </div>
  );
}

/** Can nhanh khoi dat tu do trong khung cha (trai / giua / phai, tren / giua / duoi) — tinh tu kich thuoc that tren canvas. */
function AlignInParent({ id }: { id: string }) {
  const store = useStore();
  const align = (axis: "x" | "y", where: 0 | 0.5 | 1) => {
    const el = store.iframe?.contentDocument?.querySelector<HTMLElement>(`[data-node-id="${id}"]`);
    const p = el?.offsetParent as HTMLElement | null;
    if (!el || !p) return;
    const v = axis === "x" ? (p.clientWidth - el.offsetWidth) * where : (p.clientHeight - el.offsetHeight) * where;
    store.setStyle(id, axis, Math.max(0, Math.round(v)));
  };
  const btn = (label: React.ReactNode, title: string, fn: () => void) => (
    <button type="button" title={title} onClick={fn} className="grid h-7 flex-1 place-items-center rounded-md bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground">
      {label}
    </button>
  );
  return (
    <Row label="Căn nhanh">
      <div className="grid flex-1 grid-cols-6 gap-1">
        {btn(<AlignHorizontalJustifyStart className="size-3.5" />, "Sát trái", () => align("x", 0))}
        {btn(<AlignHorizontalJustifyCenter className="size-3.5" />, "Giữa ngang", () => align("x", 0.5))}
        {btn(<AlignHorizontalJustifyEnd className="size-3.5" />, "Sát phải", () => align("x", 1))}
        {btn(<AlignVerticalJustifyStart className="size-3.5" />, "Sát trên", () => align("y", 0))}
        {btn(<AlignVerticalJustifyCenter className="size-3.5" />, "Giữa dọc", () => align("y", 0.5))}
        {btn(<AlignVerticalJustifyEnd className="size-3.5" />, "Sát dưới", () => align("y", 1))}
      </div>
    </Row>
  );
}

/** Phan tu nam trong luoi: chiem nhieu cot / hang, can rieng trong o. */
function GridItemSection({ s, set, ov, cols }: { s: Style; set: SetStyle; ov: Ov; cols: number }) {
  return (
    <Section title="Ô lưới">
      <Row label="Chiếm cột" {...ov("colSpan")}>
        <NumberField value={s.colSpan ?? 1} min={1} max={cols} onChange={(v) => set("colSpan", v && v > 1 ? v : undefined)} />
        <span className="shrink-0 text-[11px] text-muted-foreground">/ {cols}</span>
      </Row>
      <Row label="Chiếm hàng" {...ov("rowSpan")}>
        <NumberField value={s.rowSpan ?? 1} min={1} max={12} onChange={(v) => set("rowSpan", v && v > 1 ? v : undefined)} />
      </Row>
      <Row label="Căn ngang" {...ov("selfJustify")}>
        <Segmented value={s.selfJustify ?? "auto"} onChange={(v) => set("selfJustify", v === "auto" ? undefined : v)} options={selfAlignOptions("h")} />
      </Row>
      <Row label="Căn dọc" {...ov("selfAlign")}>
        <Segmented value={s.selfAlign ?? "auto"} onChange={(v) => set("selfAlign", v === "auto" ? undefined : v)} options={selfAlignOptions("v")} />
      </Row>
    </Section>
  );
}

/** Nut can rieng dang icon (chu "Tự động / Đầu / Giữa..." qua dai, bi xuong dong): h = can ngang, v = can doc. */
function selfAlignOptions(axis: "h" | "v") {
  const ic = "size-3.5";
  return [
    { value: "auto" as const, label: <Wand2 className={ic} />, title: "Tự động (theo căn của khung cha)" },
    { value: "start" as const, label: axis === "h" ? <AlignStartVertical className={ic} /> : <AlignStartHorizontal className={ic} />, title: axis === "h" ? "Trái" : "Trên" },
    { value: "center" as const, label: axis === "h" ? <AlignCenterVertical className={ic} /> : <AlignCenterHorizontal className={ic} />, title: "Giữa" },
    { value: "end" as const, label: axis === "h" ? <AlignEndVertical className={ic} /> : <AlignEndHorizontal className={ic} />, title: axis === "h" ? "Phải" : "Dưới" },
    { value: "stretch" as const, label: axis === "h" ? <StretchHorizontal className={ic} /> : <StretchVertical className={ic} />, title: axis === "h" ? "Giãn hết chiều ngang" : "Giãn hết chiều dọc" },
  ];
}

const QUICK = [0, 8, 16, 24, 32, 48, 64];

function Quick({ onPick, current }: { onPick: (v: number) => void; current?: number }) {
  return (
    <div className="flex gap-0.5 pl-[80px]">
      {QUICK.map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onPick(v)}
          className={cn("h-5 flex-1 rounded text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground", current === v && "bg-[#0d99ff]/15 text-[#0d99ff]")}
        >
          {v}
        </button>
      ))}
    </div>
  );
}

/**
 * Khoang cach gom mot cho: cach ngoai (margin — vd. section cach section tren / duoi), dem trong (padding),
 * giua cac phan tu con (gap). Moi o co nut nhanh 0–64px; tren canvas khung dang chon to mau vung padding / gap.
 */
function SpacingSection({ node, s, set, ov }: { node: BuilderNode; s: Style; set: SetStyle; ov: Ov }) {
  const layout = hasLayout(node) ? layoutOf(node, s) : null;
  const m = s.margin ?? [0, 0, 0, 0];
  const p = s.padding ?? [0, 0, 0, 0];
  const same = (a: number[]) => (a.every((x) => x === a[0]) ? a[0] : undefined);
  return (
    <Section title="Khoảng cách">
      {layout && layout !== "free" && (
        <>
          <Row label="Giữa các con" {...ov("gap")}>
            <NumberField label="↔" value={s.gap ?? (layout === "stack" ? 0 : 16)} onChange={(v) => set("gap", v)} />
          </Row>
          <Quick current={s.gap} onPick={(v) => set("gap", v)} />
        </>
      )}
      {(isContainer(node) || isProducts(node) || node.type === "collection" || node.type === "button") && (
        <>
          <PaddingField label="Đệm trong" value={s.padding} onChange={(v) => set("padding", v)} {...ov("padding")} />
          <Quick current={same(p)} onPick={(v) => set("padding", v ? [v, v, v, v] : undefined)} />
        </>
      )}
      {node.parent && (
        <>
          <PaddingField label="Cách ngoài" min={-500} value={s.margin} onChange={(v) => set("margin", v)} {...ov("margin")} />
          <Quick current={m[0] === m[2] ? m[0] : undefined} onPick={(v) => set("margin", v || m[1] || m[3] ? [v, m[1], v, m[3]] : undefined)} />
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Nút nhanh của “Cách ngoài” đặt khoảng trên + dưới (vd. section cách section). Trên canvas: vùng xanh lá = đệm trong, hồng = khoảng giữa các con (kéo vạch hồng để chỉnh).
          </p>
        </>
      )}
    </Section>
  );
}

const FILL_MODES = [
  { value: "cover" as const, label: "Phủ kín (Fill)" },
  { value: "contain" as const, label: "Vừa khung (Fit)" },
  { value: "crop" as const, label: "Cắt (Crop)" },
  { value: "auto" as const, label: "Lặp lại (Tile)" },
];

/**
 * Bang anh nen kieu Figma: o xem truoc (theo dung che do), che do Fill / Fit / Crop / Tile, phong to + keo vung
 * (Crop), co o (Tile), lop phu mau va thanh chinh mau. Anh nen render o lop rieng phia sau noi dung (schema.ts).
 */
function BgImagePanel({ node, s, set, ov }: { node: BuilderNode; s: Style; set: SetStyle; ov: Ov }) {
  const store = useStore();
  const [picker, setPicker] = useState(false);
  const mode = s.bgSize ?? "cover";
  const url = s.backgroundImage;
  const preview: React.CSSProperties = url
    ? {
        backgroundImage: `url("${url}")`,
        backgroundPosition: s.bgPosition ?? "center",
        backgroundRepeat: mode === "auto" ? "repeat" : "no-repeat",
        backgroundSize: mode === "contain" ? "contain" : mode === "auto" ? `${Math.max(24, (s.bgTile ?? 160) / 4)}px auto` : "cover",
        transform: mode === "crop" && (s.bgZoom ?? 100) > 100 ? `scale(${(s.bgZoom ?? 100) / 100})` : undefined,
        transformOrigin: s.bgPosition?.includes("%") ? s.bgPosition : "center",
        filter: adjustFilter(s.adjust) ?? undefined,
      }
    : {};
  return (
    <div className="space-y-2 rounded-lg border bg-white p-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold">Ảnh nền</span>
        {url && (
          <Select value={mode} onChange={(v) => set("bgSize", v)} options={FILL_MODES} />
        )}
      </div>
      <button
        type="button"
        onClick={() => setPicker(true)}
        title={url ? "Đổi ảnh" : "Chọn ảnh nền"}
        className="relative block aspect-[16/10] w-full overflow-hidden rounded-md border"
        style={{ background: "repeating-conic-gradient(#e8e8e8 0 25%, #fff 0 50%) 0 0/12px 12px" }}
      >
        {url ? (
          <>
            <span className="absolute inset-0" style={preview} />
            {s.overlay && <span className="absolute inset-0" style={{ background: s.overlay }} />}
            <span className="absolute right-1 bottom-1 rounded bg-black/55 px-1.5 py-0.5 text-[10px] text-white">Đổi ảnh</span>
          </>
        ) : (
          <span className="absolute inset-0 grid place-items-center text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <ImagePlus className="size-4" /> Chọn ảnh nền
            </span>
          </span>
        )}
      </button>
      <input
        className={fieldCls}
        value={url ?? ""}
        placeholder="hoặc dán link ảnh…"
        onChange={(e) => set("backgroundImage", e.target.value.trim() || undefined)}
      />
      {url && (
        <>
          {mode === "crop" && (
            <>
              <SliderRow label="Phóng to" value={s.bgZoom ?? 100} min={100} max={400} suffix="%" onChange={(v) => set("bgZoom", v > 100 ? v : undefined)} />
              <button
                type="button"
                onClick={() => startCrop(store, node.id)}
                className="flex h-7 w-full items-center justify-center gap-1.5 rounded-md bg-[#0d99ff]/10 text-[11px] font-medium text-[#0a6fbf] hover:bg-[#0d99ff]/20"
              >
                <Crop className="size-3.5" /> Kéo ảnh trên canvas để chọn vùng
              </button>
            </>
          )}
          {mode === "auto" && <SliderRow label="Cỡ ô" value={s.bgTile ?? 160} min={24} max={800} suffix="px" onChange={(v) => set("bgTile", v)} />}
          {mode !== "auto" && (
            <Row label="Vị trí" {...ov("bgPosition")}>
              <Select
                value={["center", "top", "bottom", "left", "right"].includes(s.bgPosition ?? "center") ? (s.bgPosition ?? "center") : "custom"}
                onChange={(v) => v !== "custom" && set("bgPosition", v)}
                options={[
                  { value: "center", label: "Giữa" },
                  { value: "top", label: "Trên" },
                  { value: "bottom", label: "Dưới" },
                  { value: "left", label: "Trái" },
                  { value: "right", label: "Phải" },
                  ...(["center", "top", "bottom", "left", "right"].includes(s.bgPosition ?? "center") ? [] : [{ value: "custom", label: `Tự kéo (${s.bgPosition})` }]),
                ]}
              />
            </Row>
          )}
          <Row label="Lớp phủ" {...ov("overlay")}>
            <ColorField value={s.overlay} onChange={(v) => set("overlay", v)} />
          </Row>
          <AdjustSliders value={s.adjust} onChange={(v) => set("adjust", v)} />
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">Nhấp đúp khối trên canvas để kéo ảnh · Esc để xong</span>
            <button type="button" onClick={() => set("backgroundImage", undefined)} className="text-[11px] text-destructive hover:underline">
              Bỏ ảnh
            </button>
          </div>
        </>
      )}
      <MediaPicker open={picker} onOpenChange={setPicker} onSelect={(urls) => urls[0] && set("backgroundImage", urls[0])} />
    </div>
  );
}

const ADJUST: { key: keyof ImageAdjust; label: string; min: number; max: number }[] = [
  { key: "exposure", label: "Độ sáng", min: -100, max: 100 },
  { key: "contrast", label: "Tương phản", min: -100, max: 100 },
  { key: "saturation", label: "Bão hòa", min: -100, max: 100 },
  { key: "temperature", label: "Nhiệt độ", min: -100, max: 100 },
  { key: "tint", label: "Sắc độ", min: -100, max: 100 },
  { key: "blur", label: "Làm mờ", min: 0, max: 20 },
];

/** Thanh chinh mau anh (giong Figma): keo thanh truot, nhap dup vao nhan de dat ve 0. */
function AdjustSliders({ value, onChange }: { value: ImageAdjust | undefined; onChange: (v: ImageAdjust | undefined) => void }) {
  const v = value ?? {};
  const put = (k: keyof ImageAdjust, n: number) => {
    const next = { ...v, [k]: n || undefined };
    onChange(Object.values(next).some(Boolean) ? next : undefined);
  };
  return (
    <div className="space-y-1.5 pt-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-medium text-muted-foreground">Chỉnh màu ảnh</span>
        {value && (
          <button type="button" onClick={() => onChange(undefined)} className="text-[10px] text-[#0d99ff] hover:underline">
            Đặt lại
          </button>
        )}
      </div>
      {ADJUST.map((a) => (
        <SliderRow key={a.key} label={a.label} value={v[a.key] ?? 0} min={a.min} max={a.max} center={a.min < 0} onChange={(n) => put(a.key, n)} />
      ))}
    </div>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  onChange,
  suffix = "",
  center,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  suffix?: string;
  center?: boolean;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  const from = center ? 50 : 0;
  return (
    <div className="grid grid-cols-[72px_1fr_36px] items-center gap-2">
      <span className="truncate text-[11px] text-muted-foreground" onDoubleClick={() => onChange(center ? 0 : min)} title="Nhấp đúp để đặt lại">
        {label}
      </span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full accent-[#0d99ff]"
        style={{
          background: `linear-gradient(90deg, #e5e7eb ${Math.min(from, pct)}%, #0d99ff ${Math.min(from, pct)}%, #0d99ff ${Math.max(from, pct)}%, #e5e7eb ${Math.max(from, pct)}%)`,
        }}
      />
      <span className="text-right text-[10px] text-muted-foreground tabular-nums">
        {value}
        {suffix}
      </span>
    </div>
  );
}
