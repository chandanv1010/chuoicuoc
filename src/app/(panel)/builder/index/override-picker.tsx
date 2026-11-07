"use client";

import { Loader2, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { findPageRecordsAction } from "@/modules/builder/actions";
import { PAGE_KIND_LABEL, type PageKind } from "@/modules/builder/schema";

const KINDS: PageKind[] = ["product", "catalogue", "post", "postcat"];

/** Chon loai trang + tim ban ghi -> mo trinh dung thiet ke rieng cho dung trang do (bat dau tu template cua loai). */
export function OverridePicker({ existing }: { existing: string[] }) {
  const [kind, setKind] = useState<PageKind>("product");
  const [keyword, setKeyword] = useState("");
  const [items, setItems] = useState<{ id: number; name: string; sub: string }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await findPageRecordsAction(kind, keyword);
        if (alive) setItems(r);
      } finally {
        if (alive) setLoading(false);
      }
    }, 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [kind, keyword]);

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex flex-wrap gap-2">
        <div className="flex rounded-lg bg-muted p-0.5 text-sm">
          {KINDS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={`rounded-md px-3 py-1.5 ${kind === k ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              {PAGE_KIND_LABEL[k].replace("Trang ", "")}
            </button>
          ))}
        </div>
        <label className="relative min-w-60 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="Tìm theo tên…"
            className="h-9 w-full rounded-lg border bg-background pr-3 pl-8 text-sm outline-none focus:border-primary"
          />
        </label>
      </div>
      <ul className="mt-3 max-h-80 divide-y overflow-y-auto rounded-lg border">
        {loading && !items.length ? (
          <li className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Đang tìm…
          </li>
        ) : items.length === 0 ? (
          <li className="p-3 text-sm text-muted-foreground">Không tìm thấy.</li>
        ) : (
          items.map((r) => {
            const slug = `${kind}-${r.id}`;
            const has = existing.includes(slug);
            return (
              <li key={r.id}>
                <a href={`/builder/${slug}/edit`} className="flex items-center justify-between gap-3 px-3 py-2 text-sm hover:bg-muted">
                  <span className="min-w-0">
                    <span className="block truncate">{r.name}</span>
                    {r.sub && <span className="text-xs text-muted-foreground">{r.sub}</span>}
                  </span>
                  <span className="shrink-0 text-xs font-medium text-primary">{has ? "Sửa thiết kế riêng →" : "Thiết kế riêng →"}</span>
                </a>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
