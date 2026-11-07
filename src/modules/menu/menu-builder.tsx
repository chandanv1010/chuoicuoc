"use client";

import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ImageIcon,
  LinkIcon,
  Loader2Icon,
  PlusIcon,
  SearchIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { MediaPicker } from "@/components/admin/media-picker";
import { Button } from "@/components/ui/button";
import { Input, Label, NativeSelect } from "@/components/ui/form-controls";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/interactive";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

/**
 * Thay menu.js (phan form): tao vi tri menu qua modal (ajax/menu/createCatalogue),
 * them dong menu thu cong / chon tu module (ajax/dashboard/getMenu), xoa dong (ajax/menu/deleteMenu).
 * Ten truong giu nguyen: menu_catalogue_id, menu[name][], menu[canonical][], menu[icon][], menu[order][], menu[id][].
 */

export type MenuRowValue = {
  id: string;
  name: string;
  canonical: string;
  icon: string;
  order: string;
};
type Row = MenuRowValue & { key: string };

async function post(url: string, data: Record<string, string>) {
  return fetch(url, {
    method: "POST",
    body: new URLSearchParams(data),
    headers: {
      "x-requested-with": "XMLHttpRequest",
      accept: "application/json",
    },
  });
}

/* ------------------------------ Vi tri menu ------------------------------ */

export function MenuCatalogueField({
  catalogues,
  defaultValue,
  error,
}: {
  catalogues: { id: string; name: string }[];
  defaultValue: string;
  error?: string;
}) {
  const [list, setList] = useState(catalogues);
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        <NativeSelect
          name="menu_catalogue_id"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="min-w-56 flex-1"
          aria-invalid={Boolean(error)}
        >
          <option value="0">[Chọn vị trí hiển thị]</option>
          {list.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </NativeSelect>
        <Button type="button" variant="outline" onClick={() => setOpen(true)}>
          <PlusIcon /> Tạo vị trí hiển thị
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <CreateCatalogueDialog
        open={open}
        onOpenChange={setOpen}
        onCreated={(c) => {
          setList((l) => [...l, c]);
          setValue(c.id);
        }}
      />
    </div>
  );
}

function CreateCatalogueDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: (c: { id: string; name: string }) => void;
}) {
  const [name, setName] = useState("");
  const [keyword, setKeyword] = useState("");
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (open) {
      setName("");
      setKeyword("");
      setErrors({});
    }
  }, [open]);

  const submit = async () => {
    setPending(true);
    setErrors({});
    try {
      const res = await post("/ajax/menu/createCatalogue", { name, keyword });
      if (res.status === 422) {
        setErrors((await res.json()).errors ?? {});
        return;
      }
      const json = await res.json().catch(() => null);
      if (json?.code === 0) {
        toast.success(json.message);
        onCreated({ id: String(json.data.id), name: json.data.name });
        onOpenChange(false);
      } else toast.error(json?.message ?? "Không tạo được vị trí menu");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Thêm mới vị trí hiển thị của menu</DialogTitle>
          <DialogDescription>
            Nhập đầy đủ thông tin để tạo vị trí hiển thị của menu.
          </DialogDescription>
        </DialogHeader>
        <div
          className="grid gap-4"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void submit();
            }
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="mc-name">Tên vị trí hiển thị</Label>
            <Input
              id="mc-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="off"
              aria-invalid={Boolean(errors.name)}
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name[0]}</p>
            )}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="mc-keyword">Từ khóa</Label>
            <Input
              id="mc-keyword"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              autoComplete="off"
              placeholder="vd main-menu"
              aria-invalid={Boolean(errors.keyword)}
            />
            {errors.keyword && (
              <p className="text-xs text-destructive">{errors.keyword[0]}</p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
          >
            Đóng
          </Button>
          <Button type="button" onClick={submit} disabled={pending}>
            {pending && <Loader2Icon className="animate-spin" />} Lưu lại
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------ Danh sach menu ------------------------------ */

export function MenuRowsEditor({
  defaultValue,
  models,
  level1,
  error,
}: {
  defaultValue: MenuRowValue[];
  models: Record<string, string>;
  level1: boolean;
  error?: string;
}) {
  const counter = useRef(0);
  const nextKey = () => `m${counter.current++}`;
  const [rows, setRows] = useState<Row[]>(() =>
    defaultValue.map((r) => ({ ...r, key: nextKey() })),
  );
  const [confirm, setConfirm] = useState<Row | null>(null);

  const addRow = (v?: Partial<MenuRowValue>) =>
    setRows((l) => [
      ...l,
      {
        id: "0",
        name: "",
        canonical: "",
        icon: "",
        order: "0",
        ...v,
        key: nextKey(),
      },
    ]);
  const update = (key: string, patch: Partial<MenuRowValue>) =>
    setRows((l) => l.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const remove = async (row: Row) => {
    // .delete-menu: menu da luu (id != 0) thi xoa ngay qua ajax (xoa ca menu con)
    if (row.id !== "0" && row.id !== "") {
      try {
        const res = await post("/ajax/menu/deleteMenu", { menu_id: row.id });
        const text = await res.text();
        if (!res.ok || text) throw new Error(text || `Lỗi ${res.status}`);
        toast.success("Đã xóa menu");
      } catch (e) {
        toast.error((e as Error).message);
        return;
      }
    }
    setRows((l) => l.filter((r) => r.key !== row.key));
  };

  const chosen = new Set(rows.map((r) => r.canonical));

  return (
    <div className="@container">
      <div className="grid gap-5 @3xl:grid-cols-[280px_minmax(0,1fr)]">
        <div className="grid content-start gap-3">
          <div className="rounded-lg border p-4">
            <div className="font-medium">Liên kết tự tạo</div>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
              <li>
                Đường dẫn phải hoạt động (được tạo tại các module Bài viết, Sản
                phẩm...).
              </li>
              <li>Tiêu đề và đường dẫn không được bỏ trống.</li>
              <li>Hệ thống hỗ trợ tối đa 5 cấp menu.</li>
            </ul>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3 w-full"
              onClick={() => addRow()}
            >
              <PlusIcon /> Thêm đường dẫn
            </Button>
          </div>
          {Object.entries(models).map(([model, label]) => (
            <ModulePanel
              key={model}
              model={model}
              label={label}
              chosen={chosen}
              onToggle={(item, on) => {
                if (on) addRow({ name: item.name, canonical: item.canonical });
                // bo chon: chi bo dong moi them (chua luu) co cung duong dan
                else
                  setRows((l) =>
                    l.filter(
                      (r) => !(r.canonical === item.canonical && r.id === "0"),
                    ),
                  );
              }}
            />
          ))}
        </div>
        <div className="@container min-w-0">
          {error && <p className="mb-2 text-xs text-destructive">{error}</p>}
          {rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed py-14 text-center">
              <p className="font-medium">
                Danh sách liên kết này chưa có đường dẫn nào.
              </p>
              <p className="text-sm text-muted-foreground">
                Bấm “Thêm đường dẫn” hoặc chọn liên kết từ các module bên trái.
              </p>
            </div>
          ) : (
            <div className="grid gap-2">
              <div
                className={cn(
                  "hidden gap-2 px-1 text-xs font-medium text-muted-foreground @xl:grid",
                  level1
                    ? "@xl:grid-cols-[1fr_1fr_1fr_72px_36px]"
                    : "@xl:grid-cols-[1fr_1fr_72px_36px]",
                )}
              >
                <span>Tên menu</span>
                <span>Đường dẫn</span>
                {level1 && <span>Icon (menu cấp 1)</span>}
                <span className="text-right">Vị trí</span>
                <span />
              </div>
              {rows.map((row) => (
                <div
                  key={row.key}
                  className={cn(
                    "grid gap-2 rounded-lg border bg-card p-2 @xl:border-0 @xl:p-0",
                    level1
                      ? "@xl:grid-cols-[1fr_1fr_1fr_72px_36px]"
                      : "@xl:grid-cols-[1fr_1fr_72px_36px]",
                  )}
                >
                  <Input
                    name="menu[name][]"
                    value={row.name}
                    onChange={(e) => update(row.key, { name: e.target.value })}
                    placeholder="Tên menu"
                    aria-label="Tên menu"
                  />
                  <Input
                    name="menu[canonical][]"
                    value={row.canonical}
                    onChange={(e) =>
                      update(row.key, { canonical: e.target.value })
                    }
                    placeholder="Đường dẫn"
                    aria-label="Đường dẫn"
                  />
                  {level1 && (
                    <IconInput
                      value={row.icon}
                      onChange={(icon) => update(row.key, { icon })}
                    />
                  )}
                  <Input
                    name="menu[order][]"
                    value={row.order}
                    onChange={(e) =>
                      update(row.key, {
                        order: e.target.value.replace(/[^\d-]/g, ""),
                      })
                    }
                    inputMode="numeric"
                    className="text-right"
                    aria-label="Vị trí"
                  />
                  <input type="hidden" name="menu[id][]" value={row.id} />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    aria-label="Xóa menu"
                    onClick={() =>
                      row.id !== "0" && row.id !== ""
                        ? setConfirm(row)
                        : remove(row)
                    }
                  >
                    <Trash2Icon />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
        <Dialog
          open={confirm !== null}
          onOpenChange={(o) => !o && setConfirm(null)}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Xóa menu “{confirm?.name}”?</DialogTitle>
              <DialogDescription>
                Menu đã lưu sẽ bị xóa ngay khỏi hệ thống, kèm toàn bộ menu con
                của nó. Không thể khôi phục.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setConfirm(null)}
              >
                Hủy
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={async () => {
                  const row = confirm;
                  setConfirm(null);
                  if (row) await remove(row);
                }}
              >
                <Trash2Icon /> Xóa menu
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

function IconInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex min-w-0 gap-1">
      <input type="hidden" name="menu[icon][]" value={value} />
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-md border border-input bg-card px-2 text-left text-sm shadow-xs hover:bg-accent"
        title={value || "Chọn icon"}
      >
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="size-5 shrink-0 object-contain" />
        ) : (
          <ImageIcon className="size-4 shrink-0 text-muted-foreground" />
        )}
        <span className={cn("truncate", !value && "text-muted-foreground")}>
          {value ? value.split("/").pop() : "Chọn icon"}
        </span>
      </button>
      {value && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => onChange("")}
          aria-label="Bỏ icon"
        >
          <XIcon />
        </Button>
      )}
      <MediaPicker
        open={open}
        onOpenChange={setOpen}
        onSelect={(urls) => onChange(urls[0])}
      />
    </div>
  );
}

/* --------------------------- Chon lien ket tu module --------------------------- */

type ModuleItem = { id: number; name: string; canonical: string };

function ModulePanel({
  model,
  label,
  chosen,
  onToggle,
}: {
  model: string;
  label: string;
  chosen: Set<string>;
  onToggle: (item: ModuleItem, on: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{
    items: ModuleItem[];
    lastPage: number;
    total: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(
    async (kw: string, p: number) => {
      setLoading(true);
      try {
        const qs = new URLSearchParams({ model, page: String(p) });
        if (kw) qs.set("keyword", kw);
        const json = await fetch(`/ajax/dashboard/getMenu?${qs}`, {
          headers: { accept: "application/json" },
        }).then((r) => r.json());
        setData({
          items: json.data ?? [],
          lastPage: json.last_page ?? 1,
          total: json.total ?? 0,
        });
      } catch (e) {
        toast.error((e as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [model],
  );

  // Go tu khoa: doi 0.5s roi tim (menu.js doi 1s)
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => void load(keyword, page), keyword ? 500 : 0);
    return () => clearTimeout(t);
  }, [open, keyword, page, load]);

  return (
    <div className="rounded-lg border">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-medium"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="flex items-center gap-2">
          <LinkIcon className="size-4 text-muted-foreground" /> {label}
        </span>
        <ChevronDownIcon
          className={cn("size-4 transition-transform", open && "rotate-180")}
        />
      </button>
      {open && (
        <div className="grid gap-2 border-t p-3">
          <div className="relative">
            <SearchIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={keyword}
              onChange={(e) => {
                setKeyword(e.target.value);
                setPage(1);
              }}
              onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
              placeholder="Tìm kiếm..."
              className="pl-8"
              autoComplete="off"
            />
          </div>
          <div className="relative max-h-72 min-h-16 overflow-y-auto">
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center bg-card/60">
                <Loader2Icon className="size-4 animate-spin text-muted-foreground" />
              </div>
            )}
            {data && data.items.length === 0 && !loading && (
              <p className="py-4 text-center text-xs text-muted-foreground">
                Không có kết quả
              </p>
            )}
            {data?.items.map((item) => (
              <label
                key={item.id}
                className="flex cursor-pointer items-start gap-2 rounded px-1 py-1.5 text-sm hover:bg-accent"
              >
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 shrink-0 accent-primary"
                  checked={chosen.has(item.canonical)}
                  onChange={(e) => onToggle(item, e.target.checked)}
                />
                <span className="min-w-0">
                  <span className="block truncate">{item.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    /{item.canonical}
                  </span>
                </span>
              </label>
            ))}
          </div>
          {data && data.lastPage > 1 && (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                aria-label="Trang trước"
              >
                <ChevronLeftIcon />
              </Button>
              <span>
                Trang {page}/{data.lastPage} · {data.total} mục
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={page >= data.lastPage}
                onClick={() => setPage((p) => p + 1)}
                aria-label="Trang sau"
              >
                <ChevronRightIcon />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
