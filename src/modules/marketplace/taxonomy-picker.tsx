"use client";

import { Loader2Icon, SearchIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Input, Textarea } from "@/components/ui/form-controls";

type Item = { id: string; path: string };
type Attr = { id: string; name: string; required: boolean; values?: string[] };

/**
 * Chon danh muc tren san: go tu khoa -> goi /ajax/marketplace/<san>/taxonomy -> chon.
 * Chua co ma app (dry run) thi chi nhap ma danh muc thu cong.
 * withAttributes: them o "Thuoc tinh sàn" + goi y thuoc tinh cua danh muc da chon (bat buoc in dam).
 */
export function TaxonomyPicker({
  defaultId,
  defaultLabel,
  platform = "etsy",
  accountId,
  placeholder,
  withAttributes,
  defaultAttributes,
}: {
  defaultId?: string;
  defaultLabel?: string;
  platform?: string;
  accountId?: string;
  placeholder?: string;
  withAttributes?: boolean;
  defaultAttributes?: string;
}) {
  const [id, setId] = useState(defaultId ?? "");
  const [label, setLabel] = useState(defaultLabel ?? "");
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [attrs, setAttrs] = useState<Attr[]>([]);
  const [attrNote, setAttrNote] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const numeric = platform !== "amazon";
  const base = platform === "etsy" ? "/ajax/marketplace/etsy/taxonomy?" : `/ajax/marketplace/${platform}/taxonomy?account_id=${accountId ?? ""}&`;

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (q.trim().length < 2) {
      setItems([]);
      return;
    }
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`${base}q=${encodeURIComponent(q.trim())}`);
        const data = (await res.json()) as { items?: Item[]; error?: string };
        setItems(data.items ?? []);
        setNote(data.error ?? (data.items?.length ? "" : "Không thấy danh mục phù hợp."));
      } catch {
        setNote("Không tải được danh mục.");
      } finally {
        setLoading(false);
      }
    }, 300);
  }, [q, base]);

  useEffect(() => {
    if (!withAttributes || !id || !accountId) {
      setAttrs([]);
      return;
    }
    let alive = true;
    fetch(`/ajax/marketplace/${platform}/attributes?account_id=${accountId}&category_id=${encodeURIComponent(id)}`)
      .then((r) => r.json() as Promise<{ items?: Attr[]; error?: string }>)
      .then((d) => {
        if (!alive) return;
        setAttrs(d.items ?? []);
        setAttrNote(d.error ?? "");
      })
      .catch(() => alive && setAttrNote("Không tải được thuộc tính."));
    return () => {
      alive = false;
    };
  }, [withAttributes, id, accountId, platform]);

  return (
    <div className="grid gap-2">
      <input type="hidden" name="category_label" value={label} />
      <div className="flex gap-2">
        <Input
          name="category_id"
          value={id}
          onChange={(e) => setId(numeric ? e.target.value.replace(/\D/g, "") : e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ""))}
          placeholder={numeric ? "mã danh mục" : "PRODUCT_TYPE"}
          className="w-40 shrink-0 font-mono"
          inputMode={numeric ? "numeric" : "text"}
        />
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder ?? "Tìm danh mục…"} className="pl-8" />
          {loading && <Loader2Icon className="absolute top-2.5 right-2.5 size-4 animate-spin text-muted-foreground" />}
        </div>
      </div>
      {label && <div className="text-xs text-muted-foreground">Đang chọn: {label}</div>}
      {note && <div className="text-xs text-amber-700">{note}</div>}
      {items.length > 0 && (
        <ul className="max-h-56 overflow-auto rounded-md border bg-card text-sm">
          {items.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                className="w-full px-3 py-1.5 text-left hover:bg-muted"
                onClick={() => {
                  setId(t.id);
                  setLabel(t.path);
                  setItems([]);
                  setQ("");
                }}
              >
                <span className="font-mono text-xs text-muted-foreground">{t.id}</span> {t.path}
              </button>
            </li>
          ))}
        </ul>
      )}
      {withAttributes && (
        <div className="mt-2 grid gap-1.5">
          <div className="text-sm font-medium">Thuộc tính trên sàn</div>
          <Textarea
            name="attributes"
            defaultValue={defaultAttributes ?? ""}
            className="min-h-20 font-mono text-xs"
            placeholder={platform === "amazon" ? "color = Navy\nmaterial = Cotton\nitem_type_keyword = baseball-caps" : "Chất liệu = Cotton\nXuất xứ = Việt Nam"}
          />
          <div className="text-xs text-muted-foreground">Mỗi dòng “tên hoặc mã thuộc tính = giá trị”. Thuộc tính bắt buộc của danh mục (in đậm) phải có, nếu không sàn sẽ từ chối.</div>
          {attrNote && <div className="text-xs text-amber-700">{attrNote}</div>}
          {attrs.length > 0 && (
            <ul className="max-h-48 overflow-auto rounded-md border bg-muted/30 p-2 text-xs">
              {attrs.map((a) => (
                <li key={a.id} className={a.required ? "font-semibold" : "text-muted-foreground"}>
                  {a.name}
                  {a.name !== a.id ? <span className="font-mono font-normal"> ({a.id})</span> : null}
                  {a.required ? " — bắt buộc" : ""}
                  {a.values?.length ? <span className="font-normal">: {a.values.slice(0, 8).join(", ")}{a.values.length > 8 ? "…" : ""}</span> : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
