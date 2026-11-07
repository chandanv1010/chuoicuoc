"use client";

/* eslint-disable @next/next/no-img-element -- anh xem truoc trong admin */
import { ArrowDown, ArrowUp, ChevronDown, Loader2, Plus, Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { thumbUrl } from "@/modules/frontend/image";
import { recordOptionsAction } from "../actions";
import { ICONS } from "../icons";
import type { RecordKind } from "../schema";
import { fieldCls } from "./controls";
import { useEditor } from "./store";

type Option = { id: number; name: string; image: string | null; sub: string };

const KIND_LABEL: Record<RecordKind, string> = { products: "sản phẩm", posts: "bài viết", categories: "danh mục" };

/** Danh sach ban ghi da chon (giu thu tu) + o tim de them. single: chi giu mot ban ghi. */
/** compact: mot dong (thanh tren cung) — bam vao de mo o tim dang popup. */
export function RecordPicker({
  kind,
  ids,
  onChange,
  single,
  compact,
}: {
  kind: RecordKind;
  ids: number[];
  onChange: (ids: number[]) => void;
  single?: boolean;
  compact?: boolean;
}) {
  const slug = useEditor((s) => s.slug);
  const [chosen, setChosen] = useState<Option[]>([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<Option[]>([]);
  const [loading, setLoading] = useState(false);
  const idsKey = ids.join(",");

  useEffect(() => {
    let alive = true;
    if (!ids.length) return setChosen([]);
    recordOptionsAction(slug, kind, "", ids).then((r) => alive && setChosen(r));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, kind, slug]);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoading(true);
    const t = setTimeout(() => {
      recordOptionsAction(slug, kind, q)
        .then((r) => alive && setResults(r))
        .finally(() => alive && setLoading(false));
    }, 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [q, open, kind, slug]);

  if (compact && !open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="flex h-8 w-full min-w-0 items-center gap-2 rounded-md border bg-white px-1.5 text-left hover:border-[#0d99ff]/60" title="Đổi bản ghi xem trước">
        {chosen[0] ? <Thumb src={chosen[0].image} small /> : null}
        <span className="min-w-0 flex-1 truncate text-[11px] font-medium">{chosen[0]?.name ?? "Chọn…"}</span>
        <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
      </button>
    );
  const move = (i: number, d: -1 | 1) => {
    const n = [...ids];
    const j = i + d;
    if (j < 0 || j >= n.length) return;
    [n[i], n[j]] = [n[j], n[i]];
    onChange(n);
  };

  return (
    <div className={compact ? "relative" : "space-y-1.5"}>
      {!compact && chosen.map((o, i) => (
        <div key={o.id} className="flex items-center gap-2 rounded-md border bg-white p-1 pr-1.5">
          <Thumb src={o.image} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[11px] font-medium">{o.name}</div>
            <div className="truncate text-[10px] text-muted-foreground">{o.sub}</div>
          </div>
          {!single && (
            <>
              <IconBtn onClick={() => move(i, -1)} title="Lên">
                <ArrowUp className="size-3" />
              </IconBtn>
              <IconBtn onClick={() => move(i, 1)} title="Xuống">
                <ArrowDown className="size-3" />
              </IconBtn>
            </>
          )}
          <IconBtn onClick={() => onChange(ids.filter((x) => x !== o.id))} title="Bỏ">
            <X className="size-3" />
          </IconBtn>
        </div>
      ))}
      {open ? (
        <div className={cn("rounded-md border bg-white p-1.5", compact && "absolute top-full left-0 z-50 mt-1 w-80 shadow-xl")}>
          <div className="relative">
            <Search className="absolute top-2 left-2 size-3 text-muted-foreground" />
            <input autoFocus className={cn(fieldCls, "pl-6")} placeholder={`Tìm ${KIND_LABEL[kind]}…`} value={q} onChange={(e) => setQ(e.target.value)} />
            {loading && <Loader2 className="absolute top-2 right-2 size-3 animate-spin text-muted-foreground" />}
          </div>
          <div className="mt-1 max-h-56 overflow-y-auto">
            {results
              .filter((r) => !ids.includes(r.id))
              .map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => {
                    onChange(single ? [r.id] : [...ids, r.id]);
                    if (single) setOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded p-1 text-left hover:bg-muted"
                >
                  <Thumb src={r.image} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[11px]">{r.name}</span>
                    <span className="block truncate text-[10px] text-muted-foreground">{r.sub}</span>
                  </span>
                </button>
              ))}
            {!loading && !results.length && <p className="p-2 text-center text-[11px] text-muted-foreground">Không tìm thấy</p>}
          </div>
          <button type="button" onClick={() => setOpen(false)} className="mt-1 w-full rounded py-1 text-[11px] text-muted-foreground hover:bg-muted">
            Xong
          </button>
        </div>
      ) : (
        (!single || !ids.length) && (
          <button type="button" onClick={() => setOpen(true)} className="flex h-7 w-full items-center justify-center gap-1 rounded-md border border-dashed text-[11px] text-muted-foreground hover:bg-muted">
            <Plus className="size-3" /> {single ? `Chọn ${KIND_LABEL[kind]}` : `Thêm ${KIND_LABEL[kind]}`}
          </button>
        )
      )}
      {single && !compact && !!ids.length && !open && (
        <button type="button" onClick={() => setOpen(true)} className="w-full text-[11px] text-[#0d99ff] hover:underline">
          Đổi {KIND_LABEL[kind]} khác
        </button>
      )}
    </div>
  );
}

function Thumb({ src, small }: { src: string | null; small?: boolean }) {
  const size = small ? "size-6" : "size-8";
  return src ? <img src={thumbUrl(src, 80)} alt="" className={`${size} shrink-0 rounded object-cover`} /> : <span className={`${size} shrink-0 rounded bg-muted`} />;
}

function IconBtn({ children, onClick, title }: { children: React.ReactNode; onClick: () => void; title: string }) {
  return (
    <button type="button" title={title} onClick={onClick} className="grid size-5 shrink-0 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground">
      {children}
    </button>
  );
}

/** Luoi icon co o tim (ten tieng Anh). */
export function IconPicker({ value, onChange }: { value: string | undefined; onChange: (v: string) => void }) {
  const [q, setQ] = useState("");
  const names = Object.keys(ICONS).filter((k) => k.includes(q.toLowerCase().trim()));
  return (
    <div className="space-y-1.5">
      <input className={fieldCls} placeholder="Tìm icon (heart, truck, gift…)" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="grid max-h-48 grid-cols-7 gap-1 overflow-y-auto rounded-md bg-muted/50 p-1">
        {names.map((k) => {
          const Icon = ICONS[k as keyof typeof ICONS];
          return (
            <button
              key={k}
              type="button"
              title={k}
              onClick={() => onChange(k)}
              className={cn("grid aspect-square place-items-center rounded hover:bg-white", value === k && "bg-white text-[#0d99ff] ring-1 ring-[#0d99ff]")}
            >
              <Icon className="size-4" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Danh sach lien ket {label, href} cua Menu (them / sua / xoa / doi cho). */
export function LinksEditor({ value, onChange }: { value: { label: string; href: string }[]; onChange: (v: { label: string; href: string }[]) => void }) {
  const set = (i: number, patch: Partial<{ label: string; href: string }>) => onChange(value.map((l, k) => (k === i ? { ...l, ...patch } : l)));
  const move = (i: number, d: -1 | 1) => {
    const n = [...value];
    const j = i + d;
    if (j < 0 || j >= n.length) return;
    [n[i], n[j]] = [n[j], n[i]];
    onChange(n);
  };
  return (
    <div className="space-y-1.5">
      {value.map((l, i) => (
        <div key={i} className="flex items-center gap-1">
          <div className="grid min-w-0 flex-1 grid-cols-2 gap-1">
            <input className={fieldCls} value={l.label} placeholder="Tên" onChange={(e) => set(i, { label: e.target.value })} />
            <input className={fieldCls} value={l.href} placeholder="/link" onChange={(e) => set(i, { href: e.target.value })} />
          </div>
          <IconBtn onClick={() => move(i, -1)} title="Lên">
            <ArrowUp className="size-3" />
          </IconBtn>
          <IconBtn onClick={() => onChange(value.filter((_, k) => k !== i))} title="Xóa">
            <X className="size-3" />
          </IconBtn>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...value, { label: "New link", href: "/" }])}
        className="flex h-7 w-full items-center justify-center gap-1 rounded-md border border-dashed text-[11px] text-muted-foreground hover:bg-muted"
      >
        <Plus className="size-3" /> Thêm liên kết
      </button>
    </div>
  );
}
