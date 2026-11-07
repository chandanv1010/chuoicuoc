"use client";

import { CalendarIcon, CheckIcon, ChevronLeftIcon, ChevronRightIcon, Loader2Icon, PackageIcon, SearchIcon, XIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form-controls";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/interactive";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

/**
 * Bo khoi giao dien dung chung cho man khuyen mai + voucher (thay cac doan jQuery
 * trong public/vendor/backend/library/promotion.js, voucher.js va .int / datepicker
 * cua library.js).
 */

/* ------------------------------------------------------------------ */
/* So tien: .int cua library.js (addCommas dau cham)                    */
/* ------------------------------------------------------------------ */

/** HT.addCommas: 1234567 -> "1.234.567" (chi dung cho so luong; tien dung MoneyInput / formatMoney) */
export function addCommas(v: unknown): string {
  const s = String(v ?? "").replace(/\./g, "");
  let out = "";
  for (let i = s.length; i > 0; i -= 3) out = s.slice(Math.max(0, i - 3), i) + (out ? "." + out : "");
  return out;
}

/** Gia tri ban dau: null -> "" (JS cu in "null"), so -> chuoi. */
export const initStr = (v: unknown) => (v === null || v === undefined ? "" : String(v));

/**
 * O nhap so nguyen co dau cham ngan cach (thay .int). Ban goc: o rong / khong phai so -> "0".
 * Gia tri ban dau giu nguyen (JS cu chi dinh dang khi go phim).
 */
export function IntInput({
  name,
  defaultValue,
  value,
  onChange,
  className,
  placeholder = "0",
  allowEmpty = false,
  ...rest
}: {
  name?: string;
  defaultValue?: string;
  value?: string;
  onChange?: (v: string) => void;
  className?: string;
  placeholder?: string;
  /** Cho phep de trong (o so luong moi them chua nhap) */
  allowEmpty?: boolean;
} & Omit<React.ComponentProps<"input">, "value" | "defaultValue" | "onChange">) {
  const [inner, setInner] = useState(defaultValue ?? "");
  const current = value !== undefined ? value : inner;
  const set = (v: string) => {
    if (value === undefined) setInner(v);
    onChange?.(v);
  };
  return (
    <Input
      {...rest}
      type="text"
      inputMode="numeric"
      name={name}
      value={current}
      placeholder={placeholder}
      autoComplete="off"
      className={cn("text-right tabular-nums", className)}
      onChange={(e) => {
        const digits = e.target.value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
        set(digits === "" ? "" : addCommas(digits));
      }}
      onBlur={() => {
        if (current === "" && !allowEmpty) set("0");
      }}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Ngay gio d/m/Y H:i (thay jquery.datetimepicker)                     */
/* ------------------------------------------------------------------ */

const pad = (n: number) => String(n).padStart(2, "0");

/** "d/m/Y H:i" -> "Y-m-dTH:i" cho <input type=datetime-local>; sai dinh dang -> "" */
function toLocalInput(v: string) {
  const m = v.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})$/);
  if (!m) return "";
  return `${m[3]}-${pad(+m[2])}-${pad(+m[1])}T${pad(+m[4])}:${m[5]}`;
}
function fromLocalInput(v: string) {
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}` : "";
}

/**
 * O ngay gio: go tay theo dinh dang d/m/Y H:i hoac bam bieu tuong lich de chon
 * (bo chon ngay gio cua trinh duyet). Gui len dung chuoi d/m/Y H:i nhu datepicker cu.
 */
export function DateTimeInput({
  name,
  value,
  onChange,
  disabled,
  invalid,
  id,
}: {
  name: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  id?: string;
}) {
  const picker = useRef<HTMLInputElement>(null);
  return (
    <div className="relative">
      <Input
        id={id}
        name={name}
        value={value}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        onChange={(e) => onChange(e.target.value)}
        placeholder="dd/mm/yyyy hh:mm"
        autoComplete="off"
        className="pr-9"
      />
      <button
        type="button"
        disabled={disabled}
        aria-label="Chọn ngày giờ"
        className="absolute top-1/2 right-1 flex size-7 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
        onClick={() => {
          const el = picker.current;
          if (!el) return;
          el.value = toLocalInput(value);
          try {
            el.showPicker();
          } catch {
            el.focus();
          }
        }}
      >
        <CalendarIcon className="size-4" />
      </button>
      <input
        ref={picker}
        type="datetime-local"
        tabIndex={-1}
        aria-hidden
        className="pointer-events-none absolute right-0 bottom-0 h-0 w-0 opacity-0"
        onChange={(e) => {
          const v = fromLocalInput(e.target.value);
          if (v) onChange(v);
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Goi ajax                                                           */
/* ------------------------------------------------------------------ */

export async function getJson<T>(url: string, params: Record<string, string | number | undefined> = {}): Promise<T> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined) qs.append(k, String(v));
  const res = await fetch(`${url}${qs.size ? `?${qs}` : ""}`, { headers: { "x-requested-with": "XMLHttpRequest", accept: "application/json" } });
  if (!res.ok || !(res.headers.get("content-type") ?? "").includes("json")) throw new Error(`Lỗi tải dữ liệu (${res.status})`);
  return res.json() as Promise<T>;
}

/** Paginator JSON cua Laravel (chi phan dung toi). */
export type PaginatorJson<T> = { data: T[]; current_page: number; last_page: number; total: number };

/** Mot dong trong danh sach chon. key: dinh danh duy nhat (vd id_variant). */
export type PickItem = { key: string; name: string; image?: string | null; sub?: string | null; price?: number | string | null; raw: Record<string, unknown> };

/* ------------------------------------------------------------------ */
/* Modal chon san pham (thay #findProduct + .search-object-item)      */
/* ------------------------------------------------------------------ */

/**
 * Modal tim kiem + phan trang + tick chon. `load(keyword, page)` tra ve trang du lieu.
 * Xac nhan: tra ve danh sach da tick (giu thu tu: cai cu truoc, cai moi them sau).
 */
export function PickerDialog({
  open,
  onOpenChange,
  title = "Chọn sản phẩm",
  description = "Chọn sản phẩm sẵn có hoặc tìm kiếm theo sản phẩm mà bạn mong muốn",
  placeholder = "Tìm kiếm theo tên, mã sản phẩm, SKU...",
  load,
  selected,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  placeholder?: string;
  load: (keyword: string, page: number) => Promise<PaginatorJson<PickItem>>;
  selected: PickItem[];
  onConfirm: (items: PickItem[]) => void;
}) {
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<PaginatorJson<PickItem> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<PickItem[]>(selected);
  const loadRef = useRef(load);
  loadRef.current = load;

  // Mo modal: lay lai lua chon hien tai, ve trang 1
  useEffect(() => {
    if (open) {
      setDraft(selected);
      setKeyword("");
      setPage(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    const t = setTimeout(
      async () => {
        setLoading(true);
        setError(null);
        try {
          const res = await loadRef.current(keyword, page);
          if (alive) setData(res);
        } catch (e) {
          if (alive) setError((e as Error).message);
        } finally {
          if (alive) setLoading(false);
        }
      },
      keyword ? 300 : 0,
    );
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [open, keyword, page]);

  const has = (k: string) => draft.some((d) => d.key === k);
  const toggle = (item: PickItem) => setDraft((prev) => (prev.some((d) => d.key === item.key) ? prev.filter((d) => d.key !== item.key) : [...prev, item]));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100vh-2rem)] max-w-2xl flex-col gap-3 p-0">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="px-6">
          <div className="relative">
            <SearchIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={keyword}
              onChange={(e) => {
                setKeyword(e.target.value);
                setPage(1);
              }}
              placeholder={placeholder}
              className="pl-8"
            />
          </div>
        </div>
        <div className="min-h-48 flex-1 overflow-y-auto border-y">
          {loading && !data && (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
              <Loader2Icon className="size-4 animate-spin" /> Đang tải...
            </div>
          )}
          {error && <div className="py-12 text-center text-sm text-destructive">{error}</div>}
          {data && !error && data.data.length === 0 && <div className="py-12 text-center text-sm text-muted-foreground">Không tìm thấy kết quả phù hợp.</div>}
          {data && !error && (
            <ul className={cn("divide-y", loading && "opacity-60")}>
              {data.data.map((item) => {
                const on = has(item.key);
                return (
                  <li key={item.key}>
                    <button
                      type="button"
                      onClick={() => toggle(item)}
                      className={cn("flex w-full items-center gap-3 px-6 py-2.5 text-left text-sm hover:bg-muted/50", on && "bg-primary/5")}
                    >
                      <span
                        className={cn(
                          "flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-input",
                          on && "border-primary bg-primary text-primary-foreground",
                        )}
                      >
                        {on && <CheckIcon className="size-3.5" />}
                      </span>
                      {item.image !== undefined && <ItemThumb src={item.image} />}
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-1 font-medium">{item.name}</span>
                        {item.sub && <span className="block text-xs text-muted-foreground">{item.sub}</span>}
                      </span>
                      {item.price !== undefined && item.price !== null && <span className="shrink-0 text-sm tabular-nums">{formatMoney(item.price)}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <DialogFooter className="items-center px-6 pb-6 sm:justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {data && data.last_page > 1 && (
              <>
                <Button type="button" variant="outline" size="icon-sm" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)} aria-label="Trang trước">
                  <ChevronLeftIcon />
                </Button>
                <span>
                  Trang {data.current_page}/{data.last_page}
                </span>
                <Button type="button" variant="outline" size="icon-sm" disabled={page >= data.last_page || loading} onClick={() => setPage((p) => p + 1)} aria-label="Trang sau">
                  <ChevronRightIcon />
                </Button>
              </>
            )}
            <span>Đã chọn {draft.length}</span>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Đóng
            </Button>
            <Button
              type="button"
              onClick={() => {
                onConfirm(draft);
                onOpenChange(false);
              }}
            >
              Xác nhận
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ItemThumb({ src, className }: { src: string | null | undefined; className?: string }) {
  const [broken, setBroken] = useState(false);
  return (
    <span className={cn("flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted", className)}>
      {src && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="size-full object-cover" loading="lazy" onError={() => setBroken(true)} />
      ) : (
        <PackageIcon className="size-4 text-muted-foreground" />
      )}
    </span>
  );
}

/** Khung bam de mo modal + cac the da chon (thay .boxWrapper / .fixGrid6). */
export function PickedBox({
  items,
  onOpen,
  onRemove,
  disabled,
  disabledText,
  children,
}: {
  items: PickItem[];
  onOpen: () => void;
  onRemove: (key: string) => void;
  disabled?: boolean;
  disabledText?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled || undefined}
      onClick={() => !disabled && onOpen()}
      onKeyDown={(e) => {
        if (!disabled && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onOpen();
        }
      }}
      className={cn(
        "flex min-h-10 w-full flex-wrap items-center gap-1.5 rounded-md border border-input bg-card px-2 py-1.5 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
        disabled ? "cursor-not-allowed bg-muted/50 text-muted-foreground" : "cursor-pointer hover:border-ring/60",
      )}
    >
      {disabled ? (
        <span className="px-1">{disabledText}</span>
      ) : (
        <>
          {items.length === 0 && (
            <span className="flex items-center gap-2 px-1 text-muted-foreground">
              <SearchIcon className="size-4" /> Tìm theo tên, mã sản phẩm
            </span>
          )}
          {items.map((item) => (
            <span key={item.key} className="inline-flex max-w-full items-center gap-1 rounded-md bg-secondary py-0.5 pr-1 pl-2 text-xs font-medium" title={item.name}>
              <span className="truncate">{item.name}</span>
              <button
                type="button"
                aria-label="Bỏ chọn"
                className="rounded p-0.5 text-muted-foreground hover:bg-background hover:text-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(item.key);
                }}
              >
                <XIcon className="size-3" />
              </button>
            </span>
          ))}
        </>
      )}
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* O tim kiem co danh sach goi y (thay .input-search-pd / -combo)     */
/* ------------------------------------------------------------------ */

export function SearchSuggest({
  placeholder,
  search,
  isSelected,
  onToggle,
}: {
  placeholder: string;
  search: (keyword: string) => Promise<PickItem[]>;
  isSelected: (item: PickItem) => boolean;
  onToggle: (item: PickItem) => void;
}) {
  const [keyword, setKeyword] = useState("");
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<PickItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const searchRef = useRef(search);
  searchRef.current = search;

  useEffect(() => {
    if (!open) return;
    let alive = true;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await searchRef.current(keyword);
        if (alive) setItems(res);
      } catch {
        if (alive) setItems([]);
      } finally {
        if (alive) setLoading(false);
      }
    }, 300);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [keyword, open]);

  // Bam ra ngoai thi dong (HT.unfocusSearchBox)
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div ref={wrap} className="relative">
      <SearchIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={keyword}
        placeholder={placeholder}
        className="pl-8"
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setKeyword(e.target.value);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.preventDefault(); // khong gui form
          if (e.key === "Escape") setOpen(false);
        }}
      />
      {open && (
        <div className="absolute top-full right-0 left-0 z-30 mt-1 max-h-72 overflow-y-auto rounded-md border bg-popover py-1 shadow-md">
          {loading && !items && (
            <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
              <Loader2Icon className="size-4 animate-spin" /> Đang tìm...
            </div>
          )}
          {items && items.length === 0 && !loading && <div className="px-3 py-2 text-sm text-muted-foreground">Không tìm thấy sản phẩm.</div>}
          {items?.map((item) => {
            const on = isSelected(item);
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onToggle(item)}
                className={cn("flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-muted/60", on && "bg-primary/5")}
              >
                <span className="min-w-0 flex-1 truncate">{item.name}</span>
                {item.price !== undefined && item.price !== null && <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{formatMoney(item.price)}</span>}
                <CheckIcon className={cn("size-4 shrink-0 text-primary", !on && "invisible")} />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
