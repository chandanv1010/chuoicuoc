import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Phan trang kieu Laravel (UrlWindow onEachSide = 3, giu query string nhu
 * ->withQueryString()), giao dien shadcn.
 */
export type Paginator = {
  total: number;
  perPage: number;
  currentPage: number;
  lastPage: number;
  path: string;
  query: Record<string, string>;
};

export function makePaginator(total: number, perPage: number, currentPage: number, path: string, query: Record<string, string | string[] | undefined>): Paginator {
  const flat: Record<string, string> = {};
  for (const [k, v] of Object.entries(query)) {
    if (k === "page" || v === undefined) continue;
    flat[k] = Array.isArray(v) ? v[0] : v;
  }
  return { total, perPage, currentPage: Math.max(1, currentPage), lastPage: Math.max(1, Math.ceil(total / perPage)), path, query: flat };
}

function url(p: Paginator, page: number) {
  return `${p.path}?${new URLSearchParams({ ...p.query, page: String(page) }).toString()}`;
}

const range = (from: number, to: number) => Array.from({ length: Math.max(0, to - from + 1) }, (_, i) => from + i);

function elements(p: Paginator): (number[] | "...")[] {
  const onEachSide = 3;
  const last = p.lastPage;
  if (last < onEachSide * 2 + 8) return [range(1, last)];
  const window = onEachSide * 2;
  if (p.currentPage <= window) return [range(1, window + 2), "...", range(last - 1, last)];
  if (p.currentPage > last - window) return [range(1, 2), "...", range(last - (window + 2), last)];
  return [range(1, 2), "...", range(p.currentPage - onEachSide, p.currentPage + onEachSide), "...", range(last - 1, last)];
}

const item = "flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-sm transition-colors";

export function AdminPagination({ paginator: p }: { paginator: Paginator }) {
  const from = p.total === 0 ? 0 : (p.currentPage - 1) * p.perPage + 1;
  const to = Math.min(p.total, p.currentPage * p.perPage);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-4">
      <p className="text-sm text-muted-foreground">
        Hiển thị {from}–{to} / {p.total} bản ghi
      </p>
      {p.lastPage > 1 && (
        <nav className="flex items-center gap-1" aria-label="Phân trang">
          {p.currentPage > 1 ? (
            <Link href={url(p, p.currentPage - 1)} className={cn(item, "hover:bg-accent")} aria-label="Trang trước">
              <ChevronLeftIcon className="size-4" />
            </Link>
          ) : (
            <span className={cn(item, "opacity-40")}>
              <ChevronLeftIcon className="size-4" />
            </span>
          )}
          {elements(p).map((el, i) =>
            el === "..." ? (
              <span key={`d${i}`} className={cn(item, "text-muted-foreground")}>
                …
              </span>
            ) : (
              el.map((page) =>
                page === p.currentPage ? (
                  <span key={page} aria-current="page" className={cn(item, "bg-primary font-medium text-primary-foreground")}>
                    {page}
                  </span>
                ) : (
                  <Link key={page} href={url(p, page)} className={cn(item, "border hover:bg-accent")}>
                    {page}
                  </Link>
                ),
              )
            ),
          )}
          {p.currentPage < p.lastPage ? (
            <Link href={url(p, p.currentPage + 1)} className={cn(item, "hover:bg-accent")} aria-label="Trang sau">
              <ChevronRightIcon className="size-4" />
            </Link>
          ) : (
            <span className={cn(item, "opacity-40")}>
              <ChevronRightIcon className="size-4" />
            </span>
          )}
        </nav>
      )}
    </div>
  );
}
