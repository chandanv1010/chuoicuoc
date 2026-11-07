"use client";

import { ArrowLeft, Copy, ExternalLink, Eye, History, Trash2, Layers as LayersIcon, Loader2, Monitor, MoreHorizontal, Plus, Redo2, RotateCcw, Smartphone, Tablet, Undo2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import { blockDataAction, deleteOverrideAction, previewAction, publishAction, resetDocAction, saveDraftAction, unpublishAction } from "../actions";
import { DATA_TYPES, KIND_RECORD, parseDoc, type BlockData, type Breakpoint, type BuilderDoc } from "../schema";
import { RecordPicker } from "./pickers";
import { Canvas, DragLayer } from "./canvas";
import { Inspector, type CatalogueOption, type PartOption } from "./inspector";
import { handleKey } from "./keys";
import { InsertPanel, Layers } from "./panels";
import { EditorStore, StoreContext, useEditor, useStore, type EditorState } from "./store";

/**
 * Trinh dung giao dien: [Lop | Chen] — canvas (iframe storefront that) — Inspector.
 * Luu nhap va xuat ban qua server action; trang that chi doi khi bam "Xuất bản".
 */
export function Editor({
  slug,
  title,
  doc,
  data,
  catalogues,
  publishedAt,
  page,
  slots,
  parts,
}: {
  slug: string;
  title: string;
  doc: BuilderDoc;
  data: BlockData;
  catalogues: CatalogueOption[];
  publishedAt: string | null;
  page: EditorState["page"];
  slots: Record<string, React.ReactNode>;
  /** header / footer thiet ke rieng de chon trong "Cài đặt trang" */
  parts: PartOption[];
}) {
  const [store] = useState(() => new EditorStore({ slug, doc, data, publishedAt, page, slots }));
  return (
    <StoreContext.Provider value={store}>
      <Shell title={title} catalogues={catalogues} parts={parts} />
    </StoreContext.Provider>
  );
}

function Shell({ title, catalogues, parts }: { title: string; catalogues: CatalogueOption[]; parts: PartOption[] }) {
  const store = useStore();
  const [tab, setTab] = useState<"layers" | "insert">("layers");
  const save = useCallback(async () => {
    const { slug, doc } = store.state;
    store.set({ saving: true });
    try {
      await saveDraftAction(slug, doc);
      store.set({ savedDoc: doc });
      toast.success("Đã lưu bản nháp");
    } catch (e) {
      toast.error((e as Error).message || "Lưu không thành công");
    } finally {
      store.set({ saving: false });
    }
  }, [store]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => handleKey(store, e, save);
    // Con thay doi chua luu thi hoi truoc khi roi trang
    const onUnload = (e: BeforeUnloadEvent) => {
      if (store.state.doc !== store.state.savedDoc) e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("beforeunload", onUnload);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("beforeunload", onUnload);
    };
  }, [store, save]);

  useBlockDataSync();
  const [backup, dismissBackup] = useLocalBackup();

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <TopBar title={title} onSave={save} />
      <div className="flex min-h-0 flex-1">
        <aside className="flex w-60 shrink-0 flex-col border-r bg-card">
          <div className="flex h-10 shrink-0 items-center gap-1 border-b px-2">
            <TabBtn active={tab === "layers"} onClick={() => setTab("layers")}>
              <LayersIcon className="size-3.5" /> Lớp
            </TabBtn>
            <TabBtn active={tab === "insert"} onClick={() => setTab("insert")}>
              <Plus className="size-3.5" /> Chèn
            </TabBtn>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">{tab === "layers" ? <Layers /> : <InsertPanel />}</div>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          {backup && (
            <div className="flex shrink-0 items-center gap-3 border-b border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <span className="flex-1">
                Có thay đổi <b>chưa lưu</b> từ lần sửa trước ({new Date(backup.at).toLocaleString("vi-VN")}) — có thể do lỡ chuyển trang hoặc đóng tab.
              </span>
              <button
                type="button"
                onClick={() => {
                  const doc = parseDoc(backup.doc);
                  if (doc) store.replaceDoc(doc);
                  dismissBackup(false);
                }}
                className="h-7 rounded-md bg-amber-500 px-3 font-semibold text-white hover:bg-amber-600"
              >
                Khôi phục
              </button>
              <button type="button" onClick={() => dismissBackup(true)} className="h-7 rounded-md px-2 hover:bg-amber-100">
                Bỏ qua
              </button>
            </div>
          )}
          <Canvas onSave={save} />
        </div>
        <aside className="w-72 shrink-0 overflow-y-auto border-l bg-card">
          <Inspector catalogues={catalogues} parts={parts} />
        </aside>
      </div>
      <DragLayer />
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-muted-foreground hover:text-foreground", active && "bg-muted text-foreground")}
    >
      {children}
    </button>
  );
}

const BP_ICONS: Record<Breakpoint, React.ComponentType<{ className?: string }>> = { base: Monitor, tablet: Tablet, mobile: Smartphone };
const BP_TITLE: Record<Breakpoint, string> = { base: "Desktop", tablet: "Tablet (820px)", mobile: "Mobile (390px)" };

function TopBar({ title, onSave }: { title: string; onSave: () => Promise<void> }) {
  const store = useStore();
  const bp = useEditor((s) => s.bp);
  const canUndo = useEditor((s) => s.past.length > 0);
  const canRedo = useEditor((s) => s.future.length > 0);
  const dirty = useEditor((s) => s.doc !== s.savedDoc);
  const saving = useEditor((s) => s.saving);
  const publishedAt = useEditor((s) => s.publishedAt);
  const [publishing, setPublishing] = useState(false);

  const publish = async () => {
    const { slug, doc } = store.state;
    setPublishing(true);
    try {
      await publishAction(slug, doc);
      store.set({ savedDoc: doc, publishedAt: new Date().toISOString() });
      toast.success("Đã xuất bản — trang thật đang dùng giao diện này");
    } catch (e) {
      toast.error((e as Error).message || "Xuất bản không thành công");
    } finally {
      setPublishing(false);
    }
  };
  const unpublish = async () => {
    if (!confirm("Gỡ xuất bản? Trang thật sẽ quay về giao diện code cứng; bản nháp vẫn giữ nguyên.")) return;
    try {
      await unpublishAction(store.state.slug);
      store.set({ publishedAt: null });
      toast.success("Đã gỡ xuất bản");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  const preview = async () => {
    await onSave();
    const { slug, page } = store.state;
    window.open(`/builder-preview/${slug}${page.recordId && !page.fixed ? `?id=${page.recordId}` : ""}`, "_blank");
  };

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b bg-card px-3">
      <a href="/builder/index" className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted" title="Về trang quản trị">
        <ArrowLeft className="size-4" />
      </a>
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold">{title}</div>
        <div className="text-[11px] text-muted-foreground">
          {saving ? "Đang lưu…" : dirty ? "Có thay đổi chưa lưu" : "Đã lưu"} · {publishedAt ? "Đang xuất bản" : "Chưa xuất bản (trang thật dùng giao diện code)"}
        </div>
      </div>
      <PreviewPicker />
      <div className="ml-4 flex items-center gap-0.5">
        <IconBtn title="Hoàn tác (Ctrl+Z)" disabled={!canUndo} onClick={() => store.undo()}>
          <Undo2 className="size-4" />
        </IconBtn>
        <IconBtn title="Làm lại (Ctrl+Shift+Z)" disabled={!canRedo} onClick={() => store.redo()}>
          <Redo2 className="size-4" />
        </IconBtn>
      </div>

      <div className="absolute left-1/2 flex -translate-x-1/2 rounded-lg bg-muted p-0.5">
        {(Object.keys(BP_ICONS) as Breakpoint[]).map((k) => {
          const Icon = BP_ICONS[k];
          return (
            <button
              key={k}
              type="button"
              title={BP_TITLE[k]}
              onClick={() => store.set({ bp: k })}
              className={cn("flex h-7 items-center gap-1.5 rounded-md px-3 text-xs text-muted-foreground", bp === k && "bg-white text-foreground shadow-sm")}
            >
              <Icon className="size-3.5" />
              {BP_TITLE[k].split(" ")[0]}
            </button>
          );
        })}
      </div>

      <div className="ml-auto flex items-center gap-2">
        <MoreMenu />
        {publishedAt && (
          <button type="button" onClick={unpublish} className="h-8 rounded-md px-2.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground">
            Gỡ xuất bản
          </button>
        )}
        <button type="button" onClick={preview} className="flex h-8 items-center gap-1.5 rounded-md border px-3 text-xs font-medium hover:bg-muted">
          <Eye className="size-3.5" /> Xem trước
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="h-8 rounded-md border px-3 text-xs font-medium hover:bg-muted disabled:opacity-50"
          title="Ctrl+S"
        >
          Lưu nháp
        </button>
        <button
          type="button"
          onClick={publish}
          disabled={publishing}
          className="flex h-8 items-center gap-1.5 rounded-md bg-[#0d99ff] px-3.5 text-xs font-semibold text-white hover:bg-[#0b87e0] disabled:opacity-60"
        >
          {publishing && <Loader2 className="size-3.5 animate-spin" />}
          Xuất bản
        </button>
      </div>
    </header>
  );
}

function IconBtn({ children, title, onClick, disabled }: { children: React.ReactNode; title: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}

/** Doi nguon / so luong cua khoi san pham, hoac them khoi moi -> hoi lai server lay du lieu that (tre 300ms). */
function useBlockDataSync() {
  const store = useStore();
  const doc = useEditor((s) => s.doc);
  const last = useRef<string>("");
  useEffect(() => {
    const p = (n: (typeof doc.nodes)[string]) => n.props;
    const sig = JSON.stringify(
      Object.values(doc.nodes)
        .filter((n) => DATA_TYPES.includes(n.type) || n.props.bind || n.type === "slot")
        .map((n) => [
          n.id,
          p(n).slot,
          p(n).source,
          p(n).catalogueId,
          p(n).keyword,
          p(n).limit,
          p(n).productIds,
          p(n).catSource,
          p(n).catalogueIds,
          p(n).collection,
          p(n).bind,
          p(n).links,
          p(n).withCategories,
          // khoi trang: kieu / chu ve tren server
          n.type === "slot" ? [p(n).design, p(n).label, p(n).heading, p(n).hideHeading, p(n).collapsible, p(n).thumbSize, p(n).noZoom] : null,
        ])
        .sort(),
    );
    if (!last.current) {
      last.current = sig;
      return;
    }
    if (sig === last.current) return;
    const t = setTimeout(async () => {
      try {
        last.current = sig;
        await refreshData(store);
      } catch (e) {
        toast.error((e as Error).message);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [doc, store]);
}

/** Menu "…": khoi phuc ban dang xuat ban / dat lai ve mac dinh — chi thay trong editor, Ctrl+Z de quay lai. */
function MoreMenu() {
  const store = useStore();
  const publishedAt = useEditor((s) => s.publishedAt);
  const page = useEditor((s) => s.page);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [open]);
  const reset = async (mode: "published" | "default") => {
    setOpen(false);
    const msg =
      mode === "published"
        ? "Thay nội dung đang sửa bằng bản đang xuất bản? (Ctrl+Z để quay lại; chưa lưu cho tới khi bạn bấm Lưu)"
        : "Đặt lại trang về bản mặc định? (Ctrl+Z để quay lại; chưa lưu cho tới khi bạn bấm Lưu)";
    if (!confirm(msg)) return;
    try {
      const { doc, data } = await resetDocAction(store.state.slug, mode);
      store.replaceDoc(doc);
      store.set({ data });
      if (store.state.page.kind) await refreshData(store);
      toast.success(mode === "published" ? "Đã nạp bản đang xuất bản" : "Đã đặt lại về mặc định");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  return (
    <div ref={ref} className="relative">
      <button type="button" title="Thêm" onClick={() => setOpen(!open)} className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
        <MoreHorizontal className="size-4" />
      </button>
      {open && (
        <div className="absolute top-9 right-0 z-50 w-64 rounded-lg border bg-popover p-1 text-xs shadow-xl">
          {page.kind && !page.fixed && page.recordId && (
            <a
              href={`/builder/${page.kind}-${page.recordId}/edit`}
              className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left hover:bg-muted"
              title="Tạo bản thiết kế chỉ dành cho trang đang xem (bắt đầu từ template này)"
            >
              <Copy className="size-3.5" /> Thiết kế riêng cho trang đang xem
            </a>
          )}
          {page.landing && (
            <a href={`/${page.landing}.html`} target="_blank" rel="noopener" className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left hover:bg-muted">
              <ExternalLink className="size-3.5" /> Mở trang thật /{page.landing}.html
            </a>
          )}
          {(page.landing || (page.part && store.state.slug !== page.part)) && (
            <button
              type="button"
              onClick={async () => {
                if (!confirm(page.landing ? "Xóa landing page này? Đường dẫn sẽ không còn truy cập được." : "Xóa thiết kế này? Các trang đang chọn nó sẽ quay về dùng phần chung.")) return;
                try {
                  await deleteOverrideAction(store.state.slug);
                  location.href = "/builder/index";
                } catch (e) {
                  toast.error((e as Error).message);
                }
              }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-destructive hover:bg-muted"
            >
              <Trash2 className="size-3.5" /> {page.landing ? "Xóa landing page" : "Xóa thiết kế này"}
            </button>
          )}
          {page.fixed && page.kind && (
            <button
              type="button"
              onClick={async () => {
                if (!confirm("Xóa thiết kế riêng? Trang sẽ quay về theo template.")) return;
                try {
                  await deleteOverrideAction(store.state.slug);
                  location.href = `/builder/tpl-${page.kind}/edit?id=${page.recordId}`;
                } catch (e) {
                  toast.error((e as Error).message);
                }
              }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-destructive hover:bg-muted"
            >
              <Trash2 className="size-3.5" /> Xóa thiết kế riêng (theo template)
            </button>
          )}
          <button
            type="button"
            disabled={!publishedAt}
            onClick={() => reset("published")}
            className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left hover:bg-muted disabled:opacity-40 disabled:hover:bg-transparent"
          >
            <History className="size-3.5" /> Khôi phục bản đang xuất bản
          </button>
          <button type="button" onClick={() => reset("default")} className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left hover:bg-muted">
            <RotateCcw className="size-3.5" /> Đặt lại về mặc định
          </button>
        </div>
      )}
    </div>
  );
}

type Backup = { doc: unknown; at: number };

/**
 * Tu luu tam ban dang sua vao localStorage (moi lan doi, tre 600ms) cho toi khi Luu / Xuat ban. Mo lai editor ma
 * con ban tam khac ban da luu -> hien thanh "Khoi phuc". Bao ve khi lo bam link, Back, dong tab, mat dien...
 */
function useLocalBackup(): [Backup | null, (drop: boolean) => void] {
  const store = useStore();
  const doc = useEditor((s) => s.doc);
  const saved = useEditor((s) => s.savedDoc);
  const key = `builder:backup:${store.state.slug}`;
  const [pending, setPending] = useState<Backup | null>(null);
  const asked = useRef(false);

  useEffect(() => {
    try {
      const b = JSON.parse(localStorage.getItem(key) ?? "null") as Backup | null;
      if (b?.doc && JSON.stringify(b.doc) !== JSON.stringify(store.state.savedDoc)) setPending(b);
      else localStorage.removeItem(key);
    } catch {}
    asked.current = true;
  }, [key, store]);

  useEffect(() => {
    // Chua tra loi thanh khoi phuc thi khong ghi de / xoa ban tam cu
    if (!asked.current || pending) return;
    const t = setTimeout(() => {
      try {
        if (doc === saved) localStorage.removeItem(key);
        else localStorage.setItem(key, JSON.stringify({ doc, at: Date.now() }));
      } catch {}
    }, 600);
    return () => clearTimeout(t);
  }, [doc, saved, key, pending]);

  const dismiss = (drop: boolean) => {
    if (drop)
      try {
        localStorage.removeItem(key);
      } catch {}
    setPending(null);
  };
  return [pending, dismiss];
}

/** Lay lai du lieu khoi cua hang; template trang con: ca ban ghi dang xem + khoi trang ve san (server). */
async function refreshData(store: ReturnType<typeof useStore>, recordId?: number) {
  const { slug, doc, page } = store.state;
  if (!page.kind) {
    // Trang chu / landing...: co khoi dung chung (form yeu cau thiet ke rieng) thi lay ca phan ve san tu server
    if (Object.values(doc.nodes).some((n) => n.type === "slot")) {
      const r = await previewAction(slug, null, doc);
      store.set({ data: r.data, slots: r.slots });
    } else store.set({ data: await blockDataAction(slug, doc) });
    return;
  }
  const r = await previewAction(slug, recordId ?? page.recordId, doc);
  store.set({ data: r.data, slots: r.slots, page: { ...page, recordId: r.recordId } });
}

/** "Xem với": chon san pham / danh muc / bai viet de xem template voi du lieu that. */
function PreviewPicker() {
  const store = useStore();
  const page = useEditor((s) => s.page);
  const [busy, setBusy] = useState(false);
  if (!page.kind || page.fixed || page.kind === "postcat") return null;
  const kind = KIND_RECORD[page.kind];
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <span className="shrink-0 text-[11px] text-muted-foreground">Xem với</span>
      <div className="w-56">
        <RecordPicker
          kind={kind}
          single
          compact
          ids={page.recordId ? [page.recordId] : []}
          onChange={async (ids) => {
            if (!ids[0]) return;
            setBusy(true);
            try {
              await refreshData(store, ids[0]);
            } catch (e) {
              toast.error((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        />
      </div>
      {busy && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
    </div>
  );
}
