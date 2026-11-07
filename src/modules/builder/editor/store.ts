"use client";

import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";
import { build, type Spec } from "../library";
import {
  ancestors,
  extractFragment,
  insertFragment,
  isContainer,
  moveNode,
  removeNode,
  uid,
  type BlockData,
  type Breakpoint,
  type BuilderDoc,
  type BuilderNode,
  type Fragment,
  type ItemOverride,
  type NodeProps,
  type PageKind,
  type PageSettings,
  type PartKind,
  type Style,
} from "../schema";

/**
 * State cua editor: store nho tu viet (useSyncExternalStore) thay vi them zustand. Moi thay doi tren cay di qua
 * `change()` — sao chep doc, sua ban sao, day ban cu vao lich su undo. Cac thay doi lien tiep cung `key`
 * (go so trong inspector, keo thanh truot) duoc gop thanh mot buoc undo.
 */

export type DragPayload =
  | { kind: "new"; spec: Spec; label: string }
  /** free: node dat tu do — keo doi x / y thay vi tim cho chen (sx, sy: con tro luc bat dau; x, y: toa do luc bat dau) */
  | { kind: "move"; id: string; label: string; free?: { sx: number; sy: number; x: number; y: number } };

/** Vi tri tha: chen vao `parent` tai `index`; line / box la toa do trong iframe de ve chi bao. */
export type Drop = {
  parent: string;
  index: number;
  line: { x: number; y: number; w: number; h: number } | null;
  box: { x: number; y: number; w: number; h: number };
  /** tha vao Khung tu do: toa do trong khung */
  at?: { x: number; y: number };
};

export type EditorState = {
  slug: string;
  doc: BuilderDoc;
  savedDoc: BuilderDoc;
  publishedAt: string | null;
  data: BlockData;
  selected: string | null;
  /** node dang chon nam trong the thu may cua "Danh sách dữ liệu" (null: chon tu bang Lop / khong trong danh sach) */
  selectedCopy: number | null;
  /** "one": sua chi the dang chon (ghi de rieng), "all": sua the mau (moi the doi theo) */
  itemMode: "all" | "one";
  hovered: string | null;
  bp: Breakpoint;
  editingText: string | null;
  /** anh dang o che do crop (keo de doi object-position) */
  cropping: string | null;
  drag: DragPayload | null;
  past: BuilderDoc[];
  future: BuilderDoc[];
  saving: boolean;
  /** template / thiet ke rieng trang con: loai trang, ban ghi dang xem truoc, fixed = thiet ke rieng (khong doi ban ghi) */
  page: { kind: PageKind | null; recordId: number | null; fixed: boolean; landing?: string; part?: PartKind };
  /** khoi trang da ve san (server) theo id node */
  slots: Record<string, ReactNode>;
};

const HISTORY = 100;
const CLIPBOARD_KEY = "builder:clipboard";

export class EditorStore {
  state: EditorState;
  /** Vi tri tha hien tai khi keo (doc trong vong rAF cua overlay, khong qua React). */
  drop: Drop | null = null;
  iframe: HTMLIFrameElement | null = null;
  clipboard: Fragment | null = null;
  /** Vi tri con tro khi keo (toa do cua so editor) — cho "bong ma" di theo chuot. */
  pointer = { x: 0, y: 0 };
  /** Alt dang giu khi keo: bo bat diem luoi */
  altKey = false;
  private listeners = new Set<() => void>();
  private lastKey: string | null = null;
  private lastAt = 0;

  constructor(init: Pick<EditorState, "slug" | "doc" | "data" | "publishedAt" | "page" | "slots">) {
    this.state = {
      ...init,
      savedDoc: init.doc,
      selected: null,
      selectedCopy: null,
      itemMode: "all",
      hovered: null,
      bp: "base",
      editingText: null,
      cropping: null,
      drag: null,
      past: [],
      future: [],
      saving: false,
    };
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  get = () => this.state;
  set(patch: Partial<EditorState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l());
  }

  /* ------------------------------- Lich su ------------------------------- */

  change(recipe: (doc: BuilderDoc) => void, key?: string) {
    const next = structuredClone(this.state.doc);
    recipe(next);
    const now = Date.now();
    const merge = key && key === this.lastKey && now - this.lastAt < 1000;
    this.lastKey = key ?? null;
    this.lastAt = now;
    const past = merge ? this.state.past : [...this.state.past, this.state.doc].slice(-HISTORY);
    const selected = this.state.selected && next.nodes[this.state.selected] ? this.state.selected : null;
    this.set({ doc: next, past, future: [], selected });
  }
  undo() {
    const { past, future, doc } = this.state;
    if (!past.length) return;
    this.lastKey = null;
    const prev = past[past.length - 1];
    this.set({ doc: prev, past: past.slice(0, -1), future: [doc, ...future], selected: fix(prev, this.state.selected) });
  }
  redo() {
    const { past, future, doc } = this.state;
    if (!future.length) return;
    this.lastKey = null;
    const next = future[0];
    this.set({ doc: next, past: [...past, doc], future: future.slice(1), selected: fix(next, this.state.selected) });
  }

  /* ------------------------------- Thao tac ------------------------------- */

  select(id: string | null, copy: number | null = null) {
    if (this.state.selected !== id || this.state.selectedCopy !== copy) this.set({ selected: id, selectedCopy: copy });
  }

  /* ------------------- Tuy chinh rieng mot the cua "Danh sách dữ liệu" ------------------- */

  private withItem(coll: string, idx: number, nodeId: string, key: string, fn: (o: ItemOverride) => void) {
    this.change((d) => {
      const c = d.nodes[coll];
      if (!c) return;
      const all = (c.props.perItem ??= {});
      const card = (all[idx] ??= {});
      fn((card[nodeId] ??= {}));
    }, `item:${coll}:${idx}:${nodeId}:${key}`);
  }
  setItemStyle<K extends keyof Style>(coll: string, idx: number, nodeId: string, key: K, value: Style[K] | undefined) {
    const bp = this.state.bp;
    this.withItem(coll, idx, nodeId, `${bp}:${String(key)}`, (o) => {
      const st = { ...o.style?.[bp] };
      if (value === undefined) delete st[key];
      else st[key] = value;
      o.style = { ...o.style, [bp]: st };
    });
  }
  setItemStyles(coll: string, idx: number, nodeId: string, patch: Partial<Style>, key: string) {
    const bp = this.state.bp;
    this.withItem(coll, idx, nodeId, `${bp}:${key}`, (o) => {
      o.style = { ...o.style, [bp]: { ...o.style?.[bp], ...patch } };
    });
  }
  setItemProps(coll: string, idx: number, nodeId: string, patch: Partial<NodeProps>) {
    this.withItem(coll, idx, nodeId, `props:${Object.keys(patch).join(",")}`, (o) => {
      o.props = { ...o.props, ...patch };
    });
  }
  /** Bo moi tuy chinh rieng cua the thu idx (ve lai giong the mau). */
  clearItem(coll: string, idx: number) {
    this.change((d) => {
      const c = d.nodes[coll];
      if (c?.props.perItem) delete c.props.perItem[idx];
    });
  }
  hover(id: string | null) {
    if (this.state.hovered !== id) this.set({ hovered: id });
  }

  insertSpec(spec: Spec, parent: string, index: number) {
    let id = "";
    this.change((d) => {
      id = insertFragment(d, build(spec), parent, index);
    });
    this.set({ selected: id });
    return id;
  }

  /** Chen theo nut bam (khong keo): vao container dang chon, hoac ngay sau node dang chon. */
  insertNearSelection(spec: Spec) {
    const { doc, selected } = this.state;
    const sel = selected ? doc.nodes[selected] : null;
    if (sel && isContainer(sel)) return this.insertSpec(spec, sel.id, sel.children?.length ?? 0);
    if (sel?.parent) return this.insertSpec(spec, sel.parent, doc.nodes[sel.parent].children!.indexOf(sel.id) + 1);
    return this.insertSpec(spec, doc.root, doc.nodes[doc.root].children?.length ?? 0);
  }

  /** `index` tinh tren danh sach con hien tai (truoc khi go node ra). */
  move(id: string, parent: string, index: number) {
    const n = this.state.doc.nodes[id];
    if (!n?.parent) return;
    const siblings = this.state.doc.nodes[n.parent].children ?? [];
    const cur = siblings.indexOf(id);
    let to = index;
    if (n.parent === parent) {
      if (to === cur || to === cur + 1) return;
      if (cur < to) to -= 1;
    }
    this.change((d) => moveNode(d, id, parent, to));
  }

  remove(id: string) {
    const n = this.state.doc.nodes[id];
    if (!n?.parent) return;
    const siblings = this.state.doc.nodes[n.parent].children ?? [];
    const i = siblings.indexOf(id);
    const next = siblings[i + 1] ?? siblings[i - 1] ?? n.parent;
    this.change((d) => removeNode(d, id));
    this.set({ selected: next });
  }

  duplicate(id: string) {
    const n = this.state.doc.nodes[id];
    if (!n?.parent) return;
    const frag = extractFragment(this.state.doc, id);
    let newId = "";
    this.change((d) => {
      newId = insertFragment(d, frag, n.parent!, d.nodes[n.parent!].children!.indexOf(id) + 1);
    });
    this.set({ selected: newId });
  }

  /** Copy giu ca trong localStorage: dan duoc sang trang khac (header -> footer...) va sau khi tai lai. */
  copy(id: string) {
    if (!this.state.doc.nodes[id]?.parent) return;
    this.clipboard = extractFragment(this.state.doc, id);
    try {
      localStorage.setItem(CLIPBOARD_KEY, JSON.stringify(this.clipboard));
    } catch {}
  }
  canPaste() {
    if (this.clipboard) return true;
    try {
      return !!localStorage.getItem(CLIPBOARD_KEY);
    } catch {
      return false;
    }
  }
  paste() {
    let frag = this.clipboard;
    if (!frag)
      try {
        frag = JSON.parse(localStorage.getItem(CLIPBOARD_KEY) ?? "null") as Fragment | null;
      } catch {
        frag = null;
      }
    if (!frag?.nodes?.[frag.root]) return;
    if (!frag) return;
    const { doc, selected } = this.state;
    const sel = selected ? doc.nodes[selected] : null;
    const parent = sel && isContainer(sel) ? sel.id : (sel?.parent ?? doc.root);
    const index = sel && !isContainer(sel) ? doc.nodes[parent].children!.indexOf(sel.id) + 1 : (doc.nodes[parent].children?.length ?? 0);
    let newId = "";
    this.change((d) => {
      newId = insertFragment(d, frag, parent, index);
    });
    this.set({ selected: newId });
  }

  /** Thay mot node bang khoi moi o dung vi tri (chuyen khoi co dinh sang dang tuy bien...). */
  replaceWith(id: string, spec: Spec) {
    const n = this.state.doc.nodes[id];
    if (!n?.parent) return;
    let newId = "";
    this.change((d) => {
      const i = d.nodes[n.parent!].children!.indexOf(id);
      removeNode(d, id);
      newId = insertFragment(d, build(spec), n.parent!, i);
    });
    this.set({ selected: newId });
  }

  /** Doi kieu the cua "Danh sách dữ liệu": thay the mau + ap bo cuc goi y, giu nguyen nguon du lieu. */
  setDesign(id: string, card: Spec, layout: BuilderNode["style"], props: Partial<NodeProps>) {
    const n = this.state.doc.nodes[id];
    if (!n) return;
    this.change((d) => {
      const c = d.nodes[id];
      c.children?.forEach((k) => removeNode(d, k));
      c.children = [];
      insertFragment(d, build(card), id, 0);
      c.style = structuredClone(layout);
      Object.assign(c.props, props);
    });
    this.set({ selected: id });
  }

  /** Doi ca tai lieu (khoi phuc ban xuat ban / mac dinh) — van undo duoc. */
  replaceDoc(doc: BuilderDoc) {
    this.change((d) => {
      d.root = doc.root;
      d.nodes = structuredClone(doc.nodes);
      d.settings = structuredClone(doc.settings);
    });
    this.set({ selected: null });
  }

  /** Cai dat ca trang (header / footer / SEO landing) — undo duoc; gia tri rong = bo (ve mac dinh). */
  setSettings(patch: Partial<PageSettings>) {
    this.change((d) => {
      const s: PageSettings = { ...d.settings, ...patch };
      for (const k of Object.keys(s) as (keyof PageSettings)[]) if (!s[k] || s[k] === "global") delete s[k];
      if (Object.keys(s).length) d.settings = s;
      else delete d.settings;
    }, `settings:${Object.keys(patch).join(",")}`);
  }

  /** Ctrl+G: boc node vao mot Frame moi o dung vi tri cu (giong "Wrap in frame" cua Figma). */
  wrap(id: string) {
    const n = this.state.doc.nodes[id];
    if (!n?.parent) return;
    const frameId = uid();
    this.change((d) => {
      const parent = d.nodes[n.parent!];
      const i = parent.children!.indexOf(id);
      const width = d.nodes[id].style.base?.width;
      d.nodes[frameId] = {
        id: frameId,
        type: "frame",
        props: {},
        style: { base: { direction: "column", gap: 12, ...(width ? { width } : {}) } },
        children: [id],
        parent: parent.id,
      };
      parent.children!.splice(i, 1, frameId);
      d.nodes[id].parent = frameId;
    });
    this.set({ selected: frameId });
  }

  /** Ctrl+Shift+G: go Frame, dua cac con len cha. */
  unwrap(id: string) {
    const n = this.state.doc.nodes[id];
    if (!n?.parent || n.type !== "frame") return;
    const kids = n.children ?? [];
    this.change((d) => {
      const parent = d.nodes[n.parent!];
      const i = parent.children!.indexOf(id);
      parent.children!.splice(i, 1, ...kids);
      kids.forEach((k) => (d.nodes[k].parent = parent.id));
      delete d.nodes[id];
    });
    this.set({ selected: kids[0] ?? n.parent });
  }

  /** Alt+mui ten: doi cho voi node ben canh. */
  nudge(id: string, delta: -1 | 1) {
    const n = this.state.doc.nodes[id];
    if (!n?.parent) return;
    const i = this.state.doc.nodes[n.parent].children!.indexOf(id);
    this.move(id, n.parent, delta < 0 ? i - 1 : i + 2);
  }

  /** Ghi style tai breakpoint dang sua; value undefined = xoa (quay ve gia tri ke thua). */
  setStyle<K extends keyof Style>(id: string, key: K, value: Style[K] | undefined) {
    const bp = this.state.bp;
    this.change((d) => {
      const n = d.nodes[id];
      const s = { ...n.style[bp] };
      if (value === undefined) delete s[key];
      else s[key] = value;
      n.style[bp] = s;
    }, `style:${id}:${bp}:${key}`);
  }

  /** Ghi nhieu thuoc tinh mot lan (keo / resize lien tuc) — gop thanh mot buoc undo theo `key`. */
  setStyles(id: string, patch: Partial<Style>, key: string) {
    const bp = this.state.bp;
    this.change((d) => {
      const n = d.nodes[id];
      if (n) n.style[bp] = { ...n.style[bp], ...patch };
    }, `styles:${id}:${bp}:${key}`);
  }

  setProps(id: string, patch: Partial<NodeProps>, key?: string) {
    this.change((d) => {
      Object.assign(d.nodes[id].props, patch);
    }, key ?? `props:${id}:${Object.keys(patch).join(",")}`);
  }

  rename(id: string, name: string) {
    this.change((d) => {
      d.nodes[id].name = name.trim() || undefined;
    });
  }

  /** Node se duoc chon khi bam vao `hit` (giong Figma: bam lan luot di sau vao tung lop). */
  pickTarget(hit: string, deep = false) {
    const { doc, selected } = this.state;
    if (deep) return hit;
    const chain = ancestors(doc, hit);
    const ctx = new Set(selected && doc.nodes[selected] ? ancestors(doc, selected) : []);
    ctx.add(doc.root);
    let pick = chain[1] ?? hit;
    for (let i = 1; i < chain.length; i++) if (ctx.has(doc.nodes[chain[i]].parent!)) pick = chain[i];
    return pick;
  }
}

const fix = (doc: BuilderDoc, id: string | null) => (id && doc.nodes[id] ? id : null);

export const StoreContext = createContext<EditorStore | null>(null);

export function useStore() {
  const s = useContext(StoreContext);
  if (!s) throw new Error("EditorStore missing");
  return s;
}

/** Selector phai tra ve gia tri on dinh (primitive hoac tham chieu co san trong state). */
export function useEditor<T>(sel: (s: EditorState) => T): T {
  const store = useStore();
  return useSyncExternalStore(
    store.subscribe,
    () => sel(store.state),
    () => sel(store.state),
  );
}
