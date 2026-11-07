"use client";

import { useContext, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { StoreContext } from "./store";

/** O nhap gon kieu Figma cho inspector (cao 28px, chu 12px). */

export const fieldCls =
  "h-7 w-full min-w-0 rounded-md border border-transparent bg-muted/70 px-2 text-xs outline-none transition-colors hover:border-border focus:border-[#0d99ff] focus:bg-white";

export function Section({ title, children, actions }: { title: string; children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <section className="border-b px-3 py-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-[11px] font-semibold tracking-wide text-foreground/80 uppercase">{title}</h3>
        {actions}
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

/** Dong co nhan ben trai; `overridden` = gia tri dang ghi de rieng cho breakpoint nay (bam cham xanh de bo). */
export function Row({ label, children, overridden, onReset }: { label: string; children: React.ReactNode; overridden?: boolean; onReset?: () => void }) {
  return (
    <div className="grid grid-cols-[72px_1fr] items-center gap-2">
      <span className="flex items-center gap-1 truncate text-[11px] text-muted-foreground">
        {label}
        {overridden && (
          <button type="button" title="Đang ghi đè cho màn hình này — bấm để dùng lại giá trị kế thừa" onClick={onReset} className="size-1.5 shrink-0 rounded-full bg-[#0d99ff]" />
        )}
      </span>
      <div className="flex min-w-0 items-center gap-1.5">{children}</div>
    </div>
  );
}

/**
 * O so; keo ngang tren nhan (icon / chu nho ben trai) de tang giam nhu Figma, Shift = buoc x10.
 * Gia tri rong = undefined (ke thua).
 */
export function NumberField({
  value,
  onChange,
  min = 0,
  max,
  step = 1,
  label,
  placeholder,
  className,
}: {
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: React.ReactNode;
  placeholder?: string;
  className?: string;
}) {
  const [text, setText] = useState(value === undefined ? "" : String(value));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(value === undefined ? "" : String(value));
  }, [value]);
  const clamp = (v: number) => {
    let r = Math.round(v / step) * step;
    r = Number(r.toFixed(3));
    if (r < min) r = min;
    if (max !== undefined && r > max) r = max;
    return r;
  };
  const commit = (t: string) => {
    if (t.trim() === "") return onChange(undefined);
    const v = Number(t);
    if (Number.isFinite(v)) onChange(clamp(v));
  };
  const scrub = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const start = e.clientX;
    const base = value ?? 0;
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      const delta = Math.round((ev.clientX - start) / 2) * step * (ev.shiftKey ? 10 : 1);
      onChange(clamp(base + delta));
    };
    const up = () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
  };
  return (
    <label className={cn("group relative flex min-w-0 flex-1 items-center", className)}>
      {label && (
        <span onPointerDown={scrub} className="absolute left-0 z-10 flex h-7 w-6 cursor-ew-resize items-center justify-center text-[10px] text-muted-foreground select-none">
          {label}
        </span>
      )}
      <input
        className={cn(fieldCls, label && "pl-6", "tabular-nums")}
        value={text}
        placeholder={placeholder}
        inputMode="decimal"
        onFocus={(e) => {
          focused.current = true;
          e.currentTarget.select();
        }}
        onChange={(e) => setText(e.target.value)}
        onBlur={(e) => {
          focused.current = false;
          commit(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit(e.currentTarget.value);
          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            const v = clamp((value ?? 0) + (e.key === "ArrowUp" ? 1 : -1) * step * (e.shiftKey ? 10 : 1));
            setText(String(v));
            onChange(v);
          }
        }}
      />
    </label>
  );
}

export function TextField({
  value,
  onChange,
  placeholder,
  multiline,
}: {
  value: string | undefined;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  if (multiline)
    return (
      <textarea
        className={cn(fieldCls, "h-auto min-h-16 resize-y py-1.5 leading-relaxed")}
        value={value ?? ""}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  return <input className={fieldCls} value={value ?? ""} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />;
}

export function Select<T extends string | number>({
  value,
  options,
  onChange,
}: {
  value: T | undefined;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <select
      className={cn(fieldCls, "pr-1")}
      value={value === undefined ? "" : String(value)}
      onChange={(e) => {
        const o = options.find((x) => String(x.value) === e.target.value);
        if (o) onChange(o.value);
      }}
    >
      {value === undefined && <option value="">—</option>}
      {options.map((o) => (
        <option key={String(o.value)} value={String(o.value)}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/** Nhom nut chon mot (huong, canh chu, che do kich thuoc...). */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T | undefined;
  options: { value: T; label: React.ReactNode; title?: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex h-7 min-w-0 flex-1 rounded-md bg-muted/70 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          title={o.title}
          onClick={() => onChange(o.value)}
          className={cn(
            "flex min-w-0 flex-1 items-center justify-center rounded-[5px] text-[11px] text-muted-foreground transition-colors hover:text-foreground",
            value === o.value && "bg-white text-foreground shadow-[0_1px_2px_rgba(0,0,0,.12)]",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** O mau: o mau he thong + o chu (nhan ca gradient / rgba / transparent). */
const RECENT_KEY = "builder:recent-colors";
const BASIC = ["#ffffff", "#000000", "transparent"];
const COLOR_KEYS = ["background", "color", "borderColor", "overlay"] as const;

function readRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}
function pushRecent(c: string) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify([c, ...readRecent().filter((x) => x !== c)].slice(0, 10)));
  } catch {}
}

/**
 * O mau: bam o vuong mo bang mau gom mau DANG DUNG trong trang (de giu dong bo, khong phai nho ma mau),
 * mau dung gan day va o chon mau tu do; o chu nhan ca gradient / rgba.
 */
export function ColorField({ value, onChange }: { value: string | undefined; onChange: (v: string | undefined) => void }) {
  const store = useContext(StoreContext);
  const [open, setOpen] = useState(false);
  const [used, setUsed] = useState<string[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  const hex = value && /^#[0-9a-f]{6}$/i.test(value) ? value : "#ffffff";
  const pick = (c: string | undefined) => {
    onChange(c);
    if (c && c !== "transparent") pushRecent(c);
  };

  useEffect(() => {
    if (!open) return;
    // Gom mau trong trang luc mo bang (khong theo doi lien tuc)
    const count = new Map<string, number>();
    for (const n of Object.values(store?.state.doc.nodes ?? {}))
      for (const st of Object.values(n.style))
        for (const k of COLOR_KEYS) {
          const c = st?.[k];
          if (typeof c === "string" && /^(#|rgb)/i.test(c)) count.set(c.toLowerCase(), (count.get(c.toLowerCase()) ?? 0) + 1);
        }
    setUsed([...count.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c).slice(0, 18));
    const close = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [open, store]);

  const Swatch = ({ c }: { c: string }) => (
    <button
      type="button"
      title={c}
      onClick={() => {
        pick(c);
        setOpen(false);
      }}
      className={cn("size-5 rounded border border-black/10 transition-transform hover:scale-110", value?.toLowerCase() === c && "ring-2 ring-[#0d99ff] ring-offset-1")}
      style={{ background: c === "transparent" ? "repeating-conic-gradient(#ddd 0 25%, #fff 0 50%) 0 0/6px 6px" : c }}
    />
  );

  return (
    <div ref={ref} className="relative flex min-w-0 flex-1 items-center gap-1.5">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="size-7 shrink-0 cursor-pointer overflow-hidden rounded-md border"
        style={{ background: value || "repeating-conic-gradient(#ddd 0 25%, #fff 0 50%) 0 0/8px 8px" }}
        title="Chọn màu"
      />
      <input className={fieldCls} value={value ?? ""} placeholder="Không có" onChange={(e) => onChange(e.target.value.trim() || undefined)} />
      {open && (
        <div className="absolute top-8 left-0 z-50 w-56 space-y-2 rounded-lg border bg-popover p-2.5 shadow-xl">
          {!!used.length && (
            <div>
              <div className="mb-1 text-[10px] font-medium text-muted-foreground">Màu đang dùng trong trang</div>
              <div className="flex flex-wrap gap-1">
                {used.map((c) => (
                  <Swatch key={c} c={c} />
                ))}
              </div>
            </div>
          )}
          <div>
            <div className="mb-1 text-[10px] font-medium text-muted-foreground">Gần đây · cơ bản</div>
            <div className="flex flex-wrap gap-1">
              {[...readRecent(), ...BASIC].filter((c, i, a) => a.indexOf(c) === i).map((c) => (
                <Swatch key={c} c={c} />
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 border-t pt-2">
            <label className="relative h-7 flex-1 cursor-pointer overflow-hidden rounded-md border text-center text-[11px] leading-7 hover:bg-muted">
              Màu khác…
              <input type="color" className="absolute inset-0 cursor-pointer opacity-0" value={hex} onChange={(e) => pick(e.target.value)} />
            </label>
            <button type="button" onClick={() => (onChange(undefined), setOpen(false))} className="h-7 rounded-md border px-2 text-[11px] hover:bg-muted">
              Bỏ màu
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Luoi canh 3x3 cua Auto Layout: hang = truc doc, cot = truc ngang (doi theo huong). */
export function AlignPad({
  direction,
  justify,
  align,
  onChange,
}: {
  direction: "row" | "column";
  justify: string;
  align: string;
  onChange: (justify: "start" | "center" | "end", align: "start" | "center" | "end") => void;
}) {
  const POS = ["start", "center", "end"] as const;
  const between = justify === "between";
  return (
    <div className="grid size-[64px] shrink-0 grid-cols-3 grid-rows-3 rounded-md bg-muted/70 p-1">
      {POS.map((v) =>
        POS.map((h) => {
          // Ngang: justify theo cot, align theo hang; doc thi nguoc lai
          const j = direction === "row" ? h : v;
          const a = direction === "row" ? v : h;
          // "between": ca hang theo truc chinh sang; "stretch" hien nhu canh dau
          const on = (between || j === justify) && a === (align === "stretch" ? "start" : align);
          return (
            <button
              key={`${v}${h}`}
              type="button"
              title={`${j} / ${a}`}
              onClick={() => onChange(j, a)}
              className="group grid place-items-center"
            >
              <span
                className={cn(
                  "block rounded-full transition-all",
                  on ? "size-2 bg-[#0d99ff]" : "size-1 bg-muted-foreground/40 group-hover:size-1.5 group-hover:bg-muted-foreground",
                )}
              />
            </button>
          );
        }),
      )}
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-xs">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn("relative h-4 w-7 rounded-full transition-colors", checked ? "bg-[#0d99ff]" : "bg-muted-foreground/30")}
      >
        <span className={cn("absolute top-0.5 left-0.5 size-3 rounded-full bg-white shadow transition-transform", checked && "translate-x-3")} />
      </button>
      {label}
    </label>
  );
}
