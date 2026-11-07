"use client";

import { ChevronRight, GripVertical } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BuilderTree } from "../render";
import { ancestors, BREAKPOINTS, collectionOf, effectiveStyle, isAncestor, isContainer, layoutOf, nodeName, type BuilderDoc, type Style } from "../schema";
import { ContextMenu, type MenuState } from "./context-menu";
import { handleKey } from "./keys";
import { NodeIcon } from "./panels";
import { useEditor, useStore, type Drop, type EditorStore } from "./store";

/**
 * Canvas: iframe /builder-frame (trang storefront that — header, footer, CSS cua site) ma editor "ve" noi dung
 * vao bang React portal. Nho iframe nen CSS admin va site khong dam nhau, va breakpoint la be rong that cua
 * iframe (media query chay dung). Tuong tac (hover, chon, keo, resize, crop, sua chu) bat bang listener tren
 * document cua iframe; khung chon / tay cam / chi bao tha ve o lop overlay phia tren, cap nhat moi frame bang rAF.
 */

const SELECTOR = (id: string) => `[data-node-id="${id}"]`;
const BLUE = "#0d99ff";

export function Canvas({ onSave }: { onSave: () => void }) {
  const store = useStore();
  const bp = useEditor((s) => s.bp);
  const slug = useEditor((s) => s.slug);
  // Header / footer cua canvas theo "Cài đặt trang" dang sua (doi -> iframe tai lai)
  const header = useEditor((s) => s.doc.settings?.header ?? "");
  const footer = useEditor((s) => s.doc.settings?.footer ?? "");
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [mount, setMount] = useState<HTMLElement | null>(null);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const width = BREAKPOINTS.find((b) => b.key === bp)?.width;

  // Trang trong iframe bao "da hydrate xong" (postMessage + co __builderReady) roi moi portal vao, tranh React
  // cua iframe ghi de. Iframe co the hydrate truoc ca editor nen kiem tra ca co. Kiem tra lien tuc (re): iframe tai
  // lai (bam Back / Forward, trinh duyet khoi phuc trang) thi o #builder-root doi -> gan lai portal, khong de canvas trang.
  useEffect(() => {
    let current: HTMLElement | null = null;
    const check = () => {
      const iframe = iframeRef.current;
      const win = iframe?.contentWindow as (Window & { __builderReady?: boolean }) | null;
      const root = win?.__builderReady ? (iframe?.contentDocument?.getElementById("builder-root") ?? null) : null;
      if (root === current) return;
      current = root;
      if (iframe) store.iframe = iframe;
      setMount(root);
    };
    const onMessage = (e: MessageEvent) => {
      if (e.origin === location.origin && e.data?.type === "builder-frame-ready") check();
    };
    window.addEventListener("message", onMessage);
    window.addEventListener("pageshow", check);
    const timer = setInterval(check, 300);
    check();
    return () => {
      window.removeEventListener("message", onMessage);
      window.removeEventListener("pageshow", check);
      clearInterval(timer);
    };
  }, [store]);

  useEffect(() => {
    const doc = mount?.ownerDocument;
    if (!doc) return;
    return bindCanvasEvents(store, doc, onSave, (m) => setMenu(m));
  }, [mount, store, onSave]);

  // Chon node nam trong slide dang an -> slider chuyen toi slide do
  const selected = useEditor((s) => s.selected);
  useEffect(() => {
    if (!selected) return;
    const el = store.iframe?.contentDocument?.querySelector(SELECTOR(selected));
    el?.dispatchEvent(new Event("bb-show", { bubbles: true }));
  }, [selected, store]);

  return (
    <div className="relative flex min-w-0 flex-1 flex-col bg-[#e5e5e5]">
      <div className="relative min-h-0 flex-1 overflow-hidden" onContextMenu={(e) => e.preventDefault()}>
        <div
          className="relative mx-auto h-full bg-white shadow-[0_0_0_1px_rgba(0,0,0,.08),0_8px_30px_rgba(0,0,0,.08)] transition-[width] duration-300 ease-out"
          style={{ width: width ? `${width}px` : "100%" }}
        >
          <iframe ref={iframeRef} src={`/builder-frame?slug=${slug}&header=${encodeURIComponent(header)}&footer=${encodeURIComponent(footer)}`} title="Canvas" className="block h-full w-full border-0" />
          <Overlay />
          {!mount && <div className="absolute inset-0 grid place-items-center bg-white/70 text-sm text-muted-foreground">Đang tải canvas…</div>}
        </div>
      </div>
      <Breadcrumb />
      {mount && createPortal(<CanvasContent />, mount)}
      {menu && <ContextMenu state={menu} onClose={() => setMenu(null)} />}
    </div>
  );
}

function CanvasContent() {
  const doc = useEditor((s) => s.doc);
  const data = useEditor((s) => s.data);
  const slots = useEditor((s) => s.slots);
  return <BuilderTree doc={doc} data={data} slots={slots} editing />;
}

/** Duong dan tu goc toi node dang chon — bam de chon khung cha (giong thanh duoi cung cua Webflow). */
function Breadcrumb() {
  const store = useStore();
  const doc = useEditor((s) => s.doc);
  const selected = useEditor((s) => s.selected);
  const chain = selected && doc.nodes[selected] ? ancestors(doc, selected) : [];
  return (
    <div className="flex h-8 shrink-0 items-center gap-0.5 overflow-x-auto border-t bg-card px-2 text-[11px] whitespace-nowrap text-muted-foreground">
      {!chain.length && <span className="px-1">Bấm vào một khối để chọn · kéo để di chuyển · nhấp đúp vào chữ để sửa, vào ảnh để crop</span>}
      {chain.map((id, i) => (
        <span key={id} className="flex items-center gap-0.5">
          {i > 0 && <ChevronRight className="size-3 opacity-50" />}
          <button
            type="button"
            onClick={() => store.select(id)}
            onPointerEnter={() => store.hover(id)}
            onPointerLeave={() => store.hover(null)}
            className={`flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-muted hover:text-foreground ${id === selected ? "font-semibold text-foreground" : ""}`}
          >
            <NodeIcon node={doc.nodes[id]} className="size-3" />
            {nodeName(doc.nodes[id])}
          </button>
        </span>
      ))}
    </div>
  );
}

/* ---------------------------------- Overlay ---------------------------------- */

type Box = { x: number; y: number; w: number; h: number };
const HANDLES = ["nw", "n", "ne", "e", "se", "s", "sw", "w"] as const;
type Handle = (typeof HANDLES)[number];
const HANDLE_POS: Record<Handle, string> = {
  nw: "-left-[4px] -top-[4px] cursor-nwse-resize",
  n: "left-1/2 -top-[4px] -ml-[4px] cursor-ns-resize",
  ne: "-right-[4px] -top-[4px] cursor-nesw-resize",
  e: "-right-[4px] top-1/2 -mt-[4px] cursor-ew-resize",
  se: "-right-[4px] -bottom-[4px] cursor-nwse-resize",
  s: "left-1/2 -bottom-[4px] -ml-[4px] cursor-ns-resize",
  sw: "-left-[4px] -bottom-[4px] cursor-nesw-resize",
  w: "-left-[4px] top-1/2 -mt-[4px] cursor-ew-resize",
};

function Overlay() {
  const store = useStore();
  const hoverRef = useRef<HTMLDivElement>(null);
  const selRef = useRef<HTMLDivElement>(null);
  const tagRef = useRef<HTMLButtonElement>(null);
  const tagText = useRef<HTMLSpanElement>(null);
  const sizeRef = useRef<HTMLSpanElement>(null);
  const lineRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const handlesRef = useRef<HTMLDivElement>(null);
  const spaceRef = useRef<HTMLDivElement>(null);
  const spaceSig = useRef("");

  useEffect(() => {
    let raf = 0;
    const place = (el: HTMLElement | null, r: Box | null) => {
      if (!el) return;
      if (!r) {
        el.style.display = "none";
        return;
      }
      el.style.display = "block";
      el.style.transform = `translate(${r.x}px, ${r.y}px)`;
      el.style.width = `${r.w}px`;
      el.style.height = `${r.h}px`;
    };
    const tick = () => {
      const s = store.state;
      const idoc = store.iframe?.contentDocument;
      const rect = (id: string | null): Box | null => {
        if (!id || !idoc) return null;
        const el = idoc.querySelector(SELECTOR(id));
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: r.left, y: r.top, w: r.width, h: r.height };
      };
      const moving = s.drag?.kind === "move" && !s.drag.free;
      place(hoverRef.current, s.drag || s.hovered === s.selected ? null : rect(s.hovered));
      const selEl = moving || s.editingText ? null : selectedEl(store);
      const sr = selEl?.getBoundingClientRect();
      const sel = sr ? { x: sr.left, y: sr.top, w: sr.width, h: sr.height } : null;
      place(selRef.current, sel);
      if (sel && s.selected && tagText.current && sizeRef.current && tagRef.current && handlesRef.current) {
        const n = s.doc.nodes[s.selected];
        const label = n ? nodeName(n) : "";
        if (tagText.current.textContent !== label) tagText.current.textContent = label;
        const size = `${Math.round(sel.w)} × ${Math.round(sel.h)}`;
        if (sizeRef.current.textContent !== size) sizeRef.current.textContent = size;
        // Nhan ten nam trong khung khi node sat mep tren
        tagRef.current.style.top = sel.y < 22 ? "2px" : "-22px";
        // Goc (trang / khung cha goc) khong keo / resize
        const root = !n?.parent;
        tagRef.current.style.pointerEvents = root ? "none" : "auto";
        handlesRef.current.style.display = root || s.cropping ? "none" : "block";
      }
      drawSpacing(store, spaceRef.current, spaceSig, s.drag || s.editingText || s.cropping ? null : selEl);
      const drop = s.drag ? store.drop : null;
      place(boxRef.current, drop?.box ?? null);
      place(lineRef.current, drop?.line ?? null);
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [store]);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div ref={spaceRef} onPointerDown={(e) => beginGapDrag(store, e)} />
      <div ref={hoverRef} className="absolute top-0 left-0 hidden outline outline-1" style={{ outlineColor: BLUE }} />
      <div ref={selRef} className="absolute top-0 left-0 hidden outline outline-2" style={{ outlineColor: BLUE }}>
        <button
          ref={tagRef}
          type="button"
          title="Kéo để di chuyển khối"
          onPointerDown={(e) => beginHandleDrag(store, e)}
          className="pointer-events-auto absolute left-0 flex h-5 max-w-[240px] cursor-grab items-center gap-0.5 rounded-sm pr-1.5 pl-0.5 text-[11px] leading-4 font-medium whitespace-nowrap text-white active:cursor-grabbing"
          style={{ background: BLUE }}
        >
          <GripVertical className="size-3 shrink-0 opacity-80" />
          <span ref={tagText} className="truncate" />
        </button>
        <span
          ref={sizeRef}
          className="absolute -bottom-5 left-1/2 -translate-x-1/2 rounded-sm px-1.5 py-px text-[10px] leading-4 whitespace-nowrap text-white tabular-nums"
          style={{ background: BLUE }}
        />
        <div ref={handlesRef}>
          {HANDLES.map((h) => (
            <span
              key={h}
              onPointerDown={(e) => beginResize(store, e, h)}
              className={`pointer-events-auto absolute size-[8px] border bg-white ${HANDLE_POS[h]}`}
              style={{ borderColor: BLUE }}
            />
          ))}
        </div>
      </div>
      <div
        ref={boxRef}
        className="absolute top-0 left-0 hidden rounded-[2px] outline outline-1 outline-dashed transition-[transform,width,height] duration-100"
        style={{ outlineColor: BLUE, background: "rgba(13,153,255,.05)" }}
      />
      <div ref={lineRef} className="absolute top-0 left-0 hidden rounded-full shadow-[0_0_0_1px_white] transition-transform duration-75" style={{ background: BLUE }} />
    </div>
  );
}

/* ------------------------------ Vung khoang cach ------------------------------ */

const PAD = "rgba(46,204,113,.18)";
const GAP = "rgba(255,64,160,.22)";

/**
 * Khung dang chon: to vung dem trong (xanh la) va khoang giua cac con (hong, kem so px). Vach hong la tay cam:
 * keo de doi gap. Chi ve lai khi vi tri / so do thay doi (so sanh chu ky) de khong ton moi frame.
 */
function drawSpacing(store: EditorStore, box: HTMLDivElement | null, sig: { current: string }, el: HTMLElement | null) {
  if (!box) return;
  const id = store.state.selected;
  const n = id ? store.state.doc.nodes[id] : null;
  if (!el || !n || !(isContainer(n) || n.type === "collection")) {
    if (sig.current) {
      box.innerHTML = "";
      sig.current = "";
    }
    return;
  }
  const r = el.getBoundingClientRect();
  const cs = styleOf(el);
  const pad = [cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft].map(parseFloat);
  const track = el.querySelector<HTMLElement>(":scope > .bb-track");
  const flow = track && styleOf(track).display !== "contents" ? track : el;
  const fcs = styleOf(flow);
  const row = fcs.display === "grid" || fcs.flexDirection.startsWith("row") || flow === track;
  const gap = parseFloat(row ? fcs.columnGap : fcs.rowGap) || 0;
  const kids = Array.from((track && flow !== track ? track : flow).children).filter(
    (k) => (k as HTMLElement).dataset?.nodeId && styleOf(k).position !== "absolute" && styleOf(k).display !== "none",
  ) as HTMLElement[];
  const kr = kids.map((k) => k.getBoundingClientRect());
  const key = [r.left, r.top, r.width, r.height, ...pad, gap, ...kr.flatMap((k) => [k.left, k.top, k.right, k.bottom])].map((v) => Math.round(v)).join(",");
  if (key === sig.current) return;
  sig.current = key;

  const parts: string[] = [];
  const rect = (x: number, y: number, w: number, h: number, bg: string, extra = "") =>
    w > 0 && h > 0 ? `<div style="position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${h}px;background:${bg};${extra}"></div>` : "";
  // Dem trong 4 canh
  parts.push(rect(r.left, r.top, r.width, pad[0], PAD));
  parts.push(rect(r.left, r.bottom - pad[2], r.width, pad[2], PAD));
  parts.push(rect(r.left, r.top + pad[0], pad[3], r.height - pad[0] - pad[2], PAD));
  parts.push(rect(r.right - pad[1], r.top + pad[0], pad[1], r.height - pad[0] - pad[2], PAD));
  // Khoang giua cac con lien tiep cung hang / cot
  for (let i = 0; i + 1 < kr.length && gap > 0; i++) {
    const a = kr[i];
    const b = kr[i + 1];
    let g: { x: number; y: number; w: number; h: number } | null = null;
    if (row && Math.abs(a.top - b.top) < 2 && b.left > a.right) g = { x: a.right, y: Math.min(a.top, b.top), w: b.left - a.right, h: Math.max(a.height, b.height) };
    else if (!row && b.top > a.bottom) g = { x: Math.min(a.left, b.left), y: a.bottom, w: Math.max(a.width, b.width), h: b.top - a.bottom };
    if (!g) continue;
    parts.push(rect(g.x, g.y, g.w, g.h, GAP));
    // Tay cam + nhan so px o giua khoang dau tien
    if (i === 0) {
      const cx = g.x + g.w / 2;
      const cy = g.y + g.h / 2;
      const hw = row ? 6 : 22;
      const hh = row ? 22 : 6;
      parts.push(
        `<div data-gap-handle="${row ? "x" : "y"}" title="Kéo để đổi khoảng cách giữa các phần tử" style="position:absolute;left:${cx - hw / 2}px;top:${cy - hh / 2}px;width:${hw}px;height:${hh}px;border-radius:3px;background:#ff40a0;pointer-events:auto;cursor:${row ? "col-resize" : "row-resize"};box-shadow:0 0 0 2px #fff"></div>`,
        `<div style="position:absolute;left:${cx + (row ? 8 : 16)}px;top:${cy - (row ? 8 : 18)}px;padding:0 4px;border-radius:3px;background:#ff40a0;color:#fff;font:600 10px/16px system-ui">${Math.round(gap)}</div>`,
      );
    }
  }
  box.innerHTML = parts.join("");
}

/** Keo vach hong: doi gap cua khung dang chon (the mau / chi the dang chon theo che do). */
function beginGapDrag(store: EditorStore, e: React.PointerEvent) {
  const handle = (e.target as HTMLElement).dataset.gapHandle;
  const id = store.state.selected;
  const el = selectedEl(store);
  if (!handle || !id || !el || e.button !== 0) return;
  e.preventDefault();
  e.stopPropagation();
  const track = el.querySelector<HTMLElement>(":scope > .bb-track");
  const flow = track && styleOf(track).display !== "contents" ? track : el;
  const start = parseFloat(handle === "x" ? styleOf(flow).columnGap : styleOf(flow).rowGap) || 0;
  const sx = e.clientX;
  const sy = e.clientY;
  const write = styleWriter(store, id);
  const t = e.target as HTMLElement;
  t.setPointerCapture(e.pointerId);
  const move = (ev: PointerEvent) => {
    // Hai ben khoang deu gian nen do lech chuot x2
    const d = (handle === "x" ? ev.clientX - sx : ev.clientY - sy) * 2;
    write({ gap: Math.max(0, Math.round(start + d)) }, "gap");
  };
  const up = () => {
    t.removeEventListener("pointermove", move);
    t.removeEventListener("pointerup", up);
  };
  t.addEventListener("pointermove", move);
  t.addEventListener("pointerup", up);
}

/* ------------------------------- Su kien canvas ------------------------------- */

function nodeIdOf(t: EventTarget | null): string | null {
  // Phan tu trong iframe thuoc realm khac: `instanceof Element` cua cua so editor luon false
  const n = t as (Node & Partial<Element>) | null;
  const el = n && typeof n.closest === "function" ? (n as Element) : (n?.parentElement ?? null);
  return (el?.closest("[data-node-id]") as HTMLElement | null)?.dataset.nodeId ?? null;
}

/** The thu may (data-copy) cua node duoi chuot, neu nam trong "Danh sách dữ liệu". */
function copyOf(t: EventTarget | null): number | null {
  const n = t as (Node & Partial<Element>) | null;
  const el = n && typeof n.closest === "function" ? (n as Element) : (n?.parentElement ?? null);
  const v = (el?.closest("[data-node-id]") as HTMLElement | null)?.dataset.copy;
  return v === undefined ? null : Number(v);
}

/** Phan tu cua node dang chon tren canvas (dung the dang chon neu node nam trong danh sach). */
export function selectedEl(store: EditorStore): HTMLElement | null {
  const { selected, selectedCopy } = store.state;
  const idoc = store.iframe?.contentDocument;
  if (!selected || !idoc) return null;
  return (
    (selectedCopy !== null ? idoc.querySelector<HTMLElement>(`[data-node-id="${selected}"][data-copy="${selectedCopy}"]`) : null) ??
    idoc.querySelector<HTMLElement>(SELECTOR(selected))
  );
}

/** Node dat tu do (trong Khung tu do, hoac bat "Vị trí tự do"): keo = doi toa do x / y. */
export function isFree(store: EditorStore, id: string) {
  const { doc, bp } = store.state;
  const n = doc.nodes[id];
  const p = n?.parent ? doc.nodes[n.parent] : null;
  if (!n || !p) return false;
  return effectiveStyle(n, bp).position === "absolute" || layoutOf(p, effectiveStyle(p, bp)) === "free";
}

function bindCanvasEvents(store: EditorStore, doc: Document, onSave: () => void, openMenu: (m: MenuState) => void) {
  let pending: { id: string; hit: string; copy: number | null; x: number; y: number } | null = null;
  let pan: { id: string; key: "objectPosition" | "bgPosition"; x: number; y: number; ox: number; oy: number; w: number; h: number } | null = null;
  const toParent = (e: MouseEvent) => {
    const r = store.iframe!.getBoundingClientRect();
    return { x: e.clientX + r.left, y: e.clientY + r.top };
  };

  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    const { editingText, cropping, selected, doc: tree } = store.state;
    if (editingText && (e.target as Element).closest?.(SELECTOR(editingText))) return;
    const hit = nodeIdOf(e.target);
    if (cropping) {
      const cropEl = selectedEl(store);
      if (hit === cropping && cropEl && cropEl.contains(e.target as Node)) {
        // Che do crop: keo de doi diem lay anh (anh: object-position, khung: background-position)
        const key = tree.nodes[cropping].type === "image" ? "objectPosition" : "bgPosition";
        // Anh nen nam o lop ::before (schema.ts)
        const [ox, oy] = parsePos(key === "objectPosition" ? styleOf(cropEl).objectPosition : styleOf(cropEl, "::before").backgroundPosition);
        pan = { id: cropping, key, x: e.clientX, y: e.clientY, ox, oy, w: cropEl.clientWidth, h: cropEl.clientHeight };
        e.preventDefault();
        return;
      }
      stopCrop(store);
    }
    if (!hit) return store.select(null);
    // Dang chon khung cha ma bam vao ben trong no: keo se di chuyen khung cha; bam nha ra thi chon dung node duoi chuot
    const keep = selected && selected !== hit && tree.nodes[selected]?.parent && isAncestor(tree, selected, hit) && !e.ctrlKey && !e.metaKey;
    const id = keep ? selected! : hit;
    const copy = copyOf(e.target);
    if (!keep) store.select(hit, copy);
    pending = { id, hit, copy, x: e.clientX, y: e.clientY };
  };

  const onPointerMove = (e: PointerEvent) => {
    if (pan) {
      if (!store.state.doc.nodes[pan.id]) return;
      // Keo anh sang phai = thay phan ben trai nhieu hon -> % giam
      const px = Math.max(0, Math.min(100, pan.ox - ((e.clientX - pan.x) / Math.max(1, pan.w)) * 100));
      const py = Math.max(0, Math.min(100, pan.oy - ((e.clientY - pan.y) / Math.max(1, pan.h)) * 100));
      styleWriter(store, pan.id)({ [pan.key]: `${Math.round(px)}% ${Math.round(py)}%` }, "pan");
      return;
    }
    if (store.state.drag) {
      // Chrome giu su kien chuot cho iframe noi bat dau keo — chuyen sang toa do editor
      store.altKey = e.altKey;
      const p = toParent(e);
      dragMove(store, p.x, p.y);
      return;
    }
    if (pending && Math.hypot(e.clientX - pending.x, e.clientY - pending.y) > 4) {
      const n = store.state.doc.nodes[pending.id];
      if (n?.parent && !store.state.editingText) {
        store.select(n.id);
        const r = store.iframe!.getBoundingClientRect();
        startMove(store, n.id, toParent(e), { x: pending.x + r.left, y: pending.y + r.top });
      }
      pending = null;
      return;
    }
    if (e.buttons) return;
    store.hover(nodeIdOf(e.target));
  };

  const onPointerUp = () => {
    pan = null;
    if (pending) store.select(pending.hit, pending.copy);
    pending = null;
    if (store.state.drag) finishDrag(store);
  };

  const onDblClick = (e: MouseEvent) => {
    const hit = nodeIdOf(e.target);
    if (!hit) return;
    const n = store.state.doc.nodes[hit];
    store.select(hit, copyOf(e.target));
    if (n?.type === "text") startTextEdit(store, hit);
    else if (n?.type === "image") startCrop(store, hit);
    else if (n && styleOf(selectedEl(store) ?? doc.body, "::before").backgroundImage.includes("url(")) startCrop(store, hit);
  };

  const onContext = (e: MouseEvent) => {
    e.preventDefault();
    const hit = nodeIdOf(e.target);
    if (hit) store.select(hit);
    const p = toParent(e);
    openMenu({ x: p.x, y: p.y });
  };

  // Khong cho link / nut / form trong canvas chay (header, the san pham...); mui ten / cham slider van bam duoc
  const block = (e: Event) => {
    const t = e.target as Element;
    if (store.state.editingText && t.closest?.(SELECTOR(store.state.editingText))) return;
    if (e.type === "click" && t.closest?.(".bb-arrow, .bb-dot")) return;
    e.preventDefault();
    e.stopPropagation();
  };
  const onLeave = () => store.hover(null);
  const onKey = (e: KeyboardEvent) => handleKey(store, e, onSave);

  doc.addEventListener("pointerdown", onPointerDown, true);
  doc.addEventListener("pointermove", onPointerMove, true);
  doc.addEventListener("pointerup", onPointerUp, true);
  doc.addEventListener("dblclick", onDblClick, true);
  doc.addEventListener("contextmenu", onContext, true);
  doc.addEventListener("click", block, true);
  doc.addEventListener("submit", block, true);
  doc.addEventListener("dragstart", block, true);
  doc.documentElement.addEventListener("pointerleave", onLeave);
  doc.addEventListener("keydown", onKey);
  return () => {
    doc.removeEventListener("pointerdown", onPointerDown, true);
    doc.removeEventListener("pointermove", onPointerMove, true);
    doc.removeEventListener("pointerup", onPointerUp, true);
    doc.removeEventListener("dblclick", onDblClick, true);
    doc.removeEventListener("contextmenu", onContext, true);
    doc.removeEventListener("click", block, true);
    doc.removeEventListener("submit", block, true);
    doc.removeEventListener("dragstart", block, true);
    doc.documentElement.removeEventListener("pointerleave", onLeave);
    doc.removeEventListener("keydown", onKey);
  };
}

/** Sua chu ngay tren canvas: contentEditable "plaintext-only", luu khi blur, Esc de thoat. */
export function startTextEdit(store: EditorStore, id: string) {
  const el = store.state.selected === id ? selectedEl(store) : store.iframe?.contentDocument?.querySelector<HTMLElement>(SELECTOR(id));
  if (!el) return;
  const coll = collectionOf(store.state.doc, id);
  const copy = store.state.selectedCopy;
  const own = coll && copy !== null && store.state.itemMode === "one" ? { coll: coll.id, copy } : null;
  store.set({ editingText: id, selected: id });
  el.contentEditable = "plaintext-only";
  el.style.outline = "none";
  el.style.cursor = "text";
  el.focus();
  const sel = el.ownerDocument.getSelection();
  const range = el.ownerDocument.createRange();
  range.selectNodeContents(el);
  sel?.removeAllRanges();
  sel?.addRange(range);
  const onKey = (e: KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === "Escape" || (e.key === "Enter" && (e.ctrlKey || e.metaKey))) el.blur();
  };
  const finish = () => {
    el.removeEventListener("blur", finish);
    el.removeEventListener("keydown", onKey);
    const text = el.innerText.replace(/\n$/, "");
    el.removeAttribute("contenteditable");
    el.style.outline = "";
    el.style.cursor = "";
    store.set({ editingText: null });
    if (own) store.setItemProps(own.coll, own.copy, id, { text });
    else if (text !== store.state.doc.nodes[id]?.props.text) store.setProps(id, { text });
  };
  el.addEventListener("blur", finish);
  el.addEventListener("keydown", onKey);
}

/** Crop anh: khung = kich thuoc anh (keo tay cam), keo ben trong de chon phan anh hien ra. */
export function startCrop(store: EditorStore, id: string) {
  if (store.state.selected !== id) store.select(id);
  const el = selectedEl(store);
  if (!el) return;
  el.classList.add("bb-cropping");
  store.set({ cropping: id });
}
export function stopCrop(store: EditorStore) {
  if (!store.state.cropping) return;
  store.iframe?.contentDocument?.querySelectorAll(".bb-cropping").forEach((el) => el.classList.remove("bb-cropping"));
  store.set({ cropping: null });
}

/** "50% 30%" / "center top" / "left" -> [x%, y%] */
function parsePos(v: string): [number, number] {
  const word: Record<string, number> = { left: 0, top: 0, center: 50, right: 100, bottom: 100 };
  const parts = v.split(",")[0].trim().split(/\s+/);
  const val = (t: string | undefined) => (t === undefined ? 50 : t in word ? word[t] : parseFloat(t) || 0);
  if (parts.length === 1 && (parts[0] === "top" || parts[0] === "bottom")) return [50, word[parts[0]]];
  return [val(parts[0]), val(parts[1])];
}

/* ---------------------------------- Resize ---------------------------------- */

/**
 * Keo tay cam: chuyen chieu tuong ung sang Fixed (px) va doi lien tuc; Shift giu ti le. Node dat tu do keo canh
 * trai / tren thi doi ca x / y nhu Figma.
 */
function beginResize(store: EditorStore, e: React.PointerEvent, h: Handle) {
  const id = store.state.selected;
  const el = selectedEl(store);
  if (!id || !el || e.button !== 0) return;
  e.preventDefault();
  e.stopPropagation();
  const r = el.getBoundingClientRect();
  const write = styleWriter(store, id);
  const s0 = effectiveStyle(store.state.doc.nodes[id], store.state.bp);
  const free = isFree(store, id);
  const start = { x: e.clientX, y: e.clientY, w: r.width, h: r.height, px: s0.x ?? 0, py: s0.y ?? 0 };
  const ratio = r.width / Math.max(1, r.height);
  // O trong luoi: keo ngang = doi so cot chiem, keo doc = so hang (khi luoi co "Cao moi hang"), khong dat px
  const grid = gridOf(el);
  const target = e.currentTarget as HTMLElement;
  target.setPointerCapture(e.pointerId);
  const horiz = h.includes("e") || h.includes("w");
  const vert = h.includes("n") || h.includes("s");
  const move = (ev: PointerEvent) => {
    const dx = ev.clientX - start.x;
    const dy = ev.clientY - start.y;
    let w = start.w + (h.includes("e") ? dx : h.includes("w") ? -dx : 0);
    let hh = start.h + (h.includes("s") ? dy : h.includes("n") ? -dy : 0);
    if (ev.shiftKey && horiz && vert) hh = w / ratio;
    w = Math.max(8, Math.round(w));
    hh = Math.max(8, Math.round(hh));
    const patch: Partial<Style> = {};
    if (grid && !free) {
      if (horiz) {
        const span = Math.max(1, Math.min(grid.cols, Math.round((w + grid.gap) / (grid.colW + grid.gap))));
        patch.colSpan = span > 1 ? span : undefined;
      }
      if (vert && grid.rowH) {
        patch.rowSpan = Math.max(1, Math.round((hh + grid.rowGap) / (grid.rowH + grid.rowGap)));
        if (patch.rowSpan === 1) patch.rowSpan = undefined;
      } else if (vert) patch.height = { mode: "fixed", value: hh };
    } else {
      if (horiz) patch.width = { mode: "fixed", value: w };
      if (vert) patch.height = { mode: "fixed", value: hh };
    }
    if (free && h.includes("w")) patch.x = Math.round(start.px + (start.w - w));
    if (free && h.includes("n")) patch.y = Math.round(start.py + (start.h - hh));
    write(patch, "resize");
  };
  const up = () => {
    target.removeEventListener("pointermove", move);
    target.removeEventListener("pointerup", up);
  };
  target.addEventListener("pointermove", move);
  target.addEventListener("pointerup", up);
}

/** Thong so luoi chua phan tu (so cot, be rong cot, khoang cach, cao hang) — null neu cha khong phai luoi. */
function gridOf(el: HTMLElement) {
  let p = el.parentElement;
  if (p && styleOf(p).display === "contents") p = p.parentElement;
  if (!p) return null;
  const cs = styleOf(p);
  if (cs.display !== "grid") return null;
  const cols = cs.gridTemplateColumns.split(" ").filter(Boolean).map(parseFloat);
  const rows = cs.gridAutoRows && cs.gridAutoRows !== "auto" ? parseFloat(cs.gridAutoRows) : 0;
  return { cols: cols.length, colW: cols[0] || 1, gap: parseFloat(cs.columnGap) || 0, rowGap: parseFloat(cs.rowGap) || 0, rowH: rows };
}

/** Ghi style cho node dang chon: the mau, hoac chi the dang chon khi o che do "Chỉ thẻ này". */
export function styleWriter(store: EditorStore, id: string) {
  const coll = collectionOf(store.state.doc, id);
  const copy = store.state.selectedCopy;
  if (coll && copy !== null && store.state.itemMode === "one")
    return (patch: Partial<Style>, key: string) => store.setItemStyles(coll.id, copy, id, patch, key);
  return (patch: Partial<Style>, key: string) => store.setStyles(id, patch, key);
}

/* ---------------------------------- Keo tha ---------------------------------- */

/** Keo bang nhan ten (tay cam) cua khung chon — tien cho khung cha lon khong co cho trong de bam. */
function beginHandleDrag(store: EditorStore, e: React.PointerEvent) {
  const id = store.state.selected;
  if (!id || e.button !== 0) return;
  e.preventDefault();
  e.stopPropagation();
  startMove(store, id, { x: e.clientX, y: e.clientY });
}

/** `from`: noi bam chuot (keo tu do tinh do lech tu day, khong mat doan chuot da di truoc khi vuot nguong 4px). */
function startMove(store: EditorStore, id: string, p: { x: number; y: number }, from = p) {
  const n = store.state.doc.nodes[id];
  if (!n?.parent) return;
  if (isFree(store, id)) {
    const s = effectiveStyle(n, store.state.bp);
    store.set({ drag: { kind: "move", id, label: nodeName(n), free: { sx: from.x, sy: from.y, x: s.x ?? 0, y: s.y ?? 0 } } });
  } else {
    store.set({ drag: { kind: "move", id, label: nodeName(n) } });
  }
  dragMove(store, p.x, p.y);
}

export function dragMove(store: EditorStore, px: number, py: number) {
  store.pointer = { x: px, y: py };
  const drag = store.state.drag;
  if (drag?.kind === "move" && drag.free) {
    // Node dat tu do: di chuyen theo con tro, giu Shift de khoa theo truc
    const dx = px - drag.free.sx;
    const dy = py - drag.free.sy;
    const snap = (v: number) => (store.altKey ? Math.round(v) : Math.round(v / 4) * 4);
    store.setStyles(drag.id, { x: snap(drag.free.x + dx), y: snap(drag.free.y + dy) }, "pos");
    store.drop = null;
    return;
  }
  store.drop = computeDrop(store, px, py);
}

export function finishDrag(store: EditorStore) {
  const { drag } = store.state;
  const drop = store.drop;
  store.drop = null;
  store.set({ drag: null });
  if (!drag) return;
  if (drag.kind === "move" && drag.free) return store.select(drag.id);
  if (!drop) return;
  let id: string;
  if (drag.kind === "new") id = store.insertSpec(drag.spec, drop.parent, drop.index);
  else {
    id = drag.id;
    store.move(id, drop.parent, drop.index);
  }
  // Tha vao Khung tu do: dat dung cho con tro
  if (drop.at) store.setStyles(id, { x: Math.round(drop.at.x), y: Math.round(drop.at.y) }, "pos");
  store.select(id);
}

const styleOf = (el: Element, pseudo?: string) => (el.ownerDocument.defaultView ?? window).getComputedStyle(el, pseudo);

/** Huong xep con cua phan tu: luoi / slider coi nhu hang ngang (trai -> phai). */
const isRow = (el: Element) => {
  const track = el.querySelector(":scope > .bb-track");
  if (track && styleOf(track).display !== "contents") return true;
  const cs = styleOf(el);
  return cs.display === "grid" || ((cs.display === "flex" || cs.display === "inline-flex") && cs.flexDirection.startsWith("row"));
};

/**
 * Tim vi tri tha tu toa do con tro (toa do editor). Node la container: tha vao trong, tru khi con tro sat mep
 * (khi do chen canh no trong cha). Node la (chu, anh...): chen truoc / sau theo nua gan con tro, theo huong
 * cua cha. Bo qua chinh node dang keo va cac con cua no.
 */
export function computeDrop(store: EditorStore, px: number, py: number): Drop | null {
  const iframe = store.iframe;
  const idoc = iframe?.contentDocument;
  if (!iframe || !idoc) return null;
  const r = iframe.getBoundingClientRect();
  const x = px - r.left;
  const y = py - r.top;
  if (x < 0 || y < 0 || x > r.width || y > r.height) return null;
  const { doc, drag, bp } = store.state;
  const dragId = drag?.kind === "move" ? drag.id : null;

  let target: string | null = null;
  let el: HTMLElement | null = null;
  for (const e of idoc.elementsFromPoint(x, y)) {
    const ne = e.closest<HTMLElement>("[data-node-id]");
    const id = ne?.dataset.nodeId;
    if (!id || !doc.nodes[id]) continue;
    if (dragId && isAncestor(doc, dragId, id)) continue;
    target = id;
    el = ne;
    break;
  }
  if (!target || !el) return inside(idoc, doc, doc.root, x, y, dragId);

  const node = doc.nodes[target];
  if (isContainer(node)) {
    const rect = el.getBoundingClientRect();
    // Khung tu do: tha vao trong, dung toa do con tro
    if (layoutOf(node, effectiveStyle(node, bp)) === "free" && (!node.parent || (x - rect.left > 12 && rect.right - x > 12 && y - rect.top > 12 && rect.bottom - y > 12))) {
      return {
        parent: target,
        index: node.children?.length ?? 0,
        line: null,
        box: { x: rect.left, y: rect.top, w: rect.width, h: rect.height },
        at: { x: x - rect.left - el.clientLeft, y: y - rect.top - el.clientTop },
      };
    }
    if (node.parent) {
      const parentEl = idoc.querySelector(SELECTOR(node.parent));
      const row = parentEl ? isRow(parentEl) : false;
      const edge = Math.min(12, (row ? rect.width : rect.height) / 4);
      const nearStart = row ? x - rect.left < edge : y - rect.top < edge;
      const nearEnd = row ? rect.right - x < edge : rect.bottom - y < edge;
      if (nearStart || nearEnd) {
        const i = doc.nodes[node.parent].children!.indexOf(target);
        return between(idoc, doc, node.parent, i + (nearEnd ? 1 : 0), dragId);
      }
    }
    return inside(idoc, doc, target, x, y, dragId);
  }
  if (!node.parent) return null;
  const parentEl = idoc.querySelector(SELECTOR(node.parent));
  const rect = el.getBoundingClientRect();
  const before = parentEl && isRow(parentEl) ? x < rect.left + rect.width / 2 : y < rect.top + rect.height / 2;
  const i = doc.nodes[node.parent].children!.indexOf(target);
  return between(idoc, doc, node.parent, i + (before ? 0 : 1), dragId);
}

/** Tha vao trong container: tim cho chen giua cac con theo huong bo cuc. */
function inside(idoc: Document, doc: BuilderDoc, parent: string, x: number, y: number, dragId: string | null): Drop | null {
  const pel = idoc.querySelector(SELECTOR(parent));
  if (!pel) return null;
  const row = isRow(pel);
  const kids = (doc.nodes[parent].children ?? []).filter((k) => k !== dragId);
  let index = doc.nodes[parent].children?.length ?? 0;
  for (const k of kids) {
    const kr = idoc.querySelector(SELECTOR(k))?.getBoundingClientRect();
    if (!kr) continue;
    const hit = row ? (x < kr.left + kr.width / 2 && y < kr.bottom) || y < kr.top : y < kr.top + kr.height / 2;
    if (hit) {
      index = doc.nodes[parent].children!.indexOf(k);
      break;
    }
  }
  return between(idoc, doc, parent, index, dragId);
}

/** Drop tai (parent, index) kem toa do duong chi bao: nam giua khoang gap truoc con thu index. */
function between(idoc: Document, doc: BuilderDoc, parent: string, index: number, dragId: string | null): Drop | null {
  const pel = idoc.querySelector(SELECTOR(parent));
  if (!pel) return null;
  const pr = pel.getBoundingClientRect();
  const box = { x: pr.left, y: pr.top, w: pr.width, h: pr.height };
  const row = isRow(pel);
  const track = pel.querySelector(":scope > .bb-track");
  const cs = styleOf(track && styleOf(track).display !== "contents" ? track : pel);
  const gap = parseFloat(row ? cs.columnGap : cs.rowGap) || 0;
  const all = doc.nodes[parent].children ?? [];
  const rectOf = (id: string) => idoc.querySelector(SELECTOR(id))?.getBoundingClientRect();
  // Bo qua node dang keo khi tim hang xom de duong chi bao khong dinh vao no
  const after = all.slice(index).find((k) => k !== dragId);
  const beforeId = [...all.slice(0, index)].reverse().find((k) => k !== dragId);
  const T = 2;
  let line: Drop["line"] = null;
  const a = after ? rectOf(after) : undefined;
  const b = beforeId ? rectOf(beforeId) : undefined;
  if (a) {
    line = row
      ? { x: a.left - Math.max(gap, 4) / 2 - T / 2, y: a.top, w: T, h: a.height }
      : { x: a.left, y: a.top - Math.max(gap, 4) / 2 - T / 2, w: a.width, h: T };
  } else if (b) {
    line = row
      ? { x: b.right + Math.max(gap, 4) / 2 - T / 2, y: b.top, w: T, h: b.height }
      : { x: b.left, y: b.bottom + Math.max(gap, 4) / 2 - T / 2, w: b.width, h: T };
  }
  return { parent, index, line, box };
}

/* ------------------------------ Lop keo o editor ------------------------------ */

/** Phu toan man hinh khi dang keo: bat chuot ca khi di tren iframe, ve "bong ma" theo con tro. */
export function DragLayer() {
  const store = useStore();
  const drag = useEditor((s) => s.drag);
  const ghostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!drag) return;
    let raf = 0;
    const tick = () => {
      const g = ghostRef.current;
      if (g) {
        g.style.transform = `translate(${store.pointer.x + 14}px, ${store.pointer.y + 14}px)`;
        g.dataset.ok = store.drop || (drag.kind === "move" && drag.free) ? "1" : "0";
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        store.drop = null;
        store.set({ drag: null });
      }
    };
    window.addEventListener("keydown", onKey);
    const idoc = store.iframe?.contentDocument;
    const idElement = drag.kind === "move" && !drag.free ? idoc?.querySelector(SELECTOR(drag.id)) : null;
    idElement?.classList.add("bb-dragging");
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
      idElement?.classList.remove("bb-dragging");
    };
  }, [drag, store]);

  if (!drag) return null;
  return (
    <div
      className="fixed inset-0 z-[100] cursor-grabbing"
      onPointerMove={(e) => {
        store.altKey = e.altKey;
        dragMove(store, e.clientX, e.clientY);
      }}
      onPointerUp={() => finishDrag(store)}
    >
      {!(drag.kind === "move" && drag.free) && (
        <div
          ref={ghostRef}
          className="pointer-events-none fixed top-0 left-0 rounded-md px-2 py-1 text-xs font-medium text-white shadow-lg data-[ok=0]:!bg-neutral-500"
          style={{ background: BLUE }}
        >
          {drag.label}
        </div>
      )}
    </div>
  );
}

/** Bat dau keo tu bang "Chèn": chi thanh keo that khi chuot di quá 4px, bam tha nhanh = chen canh node dang chon. */
export function beginPaletteDrag(store: EditorStore, e: React.PointerEvent, payload: () => { spec: import("../library").Spec; label: string }) {
  if (e.button !== 0) return;
  const sx = e.clientX;
  const sy = e.clientY;
  const move = (ev: PointerEvent) => {
    if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 4) return;
    cleanup();
    const p = payload();
    store.set({ drag: { kind: "new", spec: p.spec, label: p.label } });
    dragMove(store, ev.clientX, ev.clientY);
  };
  const up = () => {
    cleanup();
    store.insertNearSelection(payload().spec);
  };
  const cleanup = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
}
