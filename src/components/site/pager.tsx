import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Phan trang kieu Amazon (< Previous 1 2 3 ... Next >). Duong dan giu kieu URL cu:
 * trang 1 = <base>.html, trang N = <base>/page-N.html, tham so loc giu trong query.
 */
export function pageHref(base: string, page: number, query: [string, string][]) {
  const qs = new URLSearchParams(query.filter(([k, v]) => k !== "page" && v !== "")).toString();
  const path = page > 1 ? `${base}/page-${page}.html` : `${base}.html`;
  return qs ? `${path}?${qs}` : path;
}

export function Pager({
  base = "",
  page,
  lastPage,
  query = [],
  href,
}: {
  base?: string;
  page: number;
  lastPage: number;
  query?: [string, string][];
  /** Tu dung link (vd trang tai khoan dung ?page=N) */
  href?: (page: number) => string;
}) {
  if (lastPage <= 1) return null;
  const link = href ?? ((p: number) => pageHref(base, p, query));
  const pages: (number | "gap")[] = [];
  for (let p = 1; p <= lastPage; p++) {
    if (p === 1 || p === lastPage || Math.abs(p - page) <= 1) pages.push(p);
    else if (pages[pages.length - 1] !== "gap") pages.push("gap");
  }
  const cell = "flex h-10 min-w-10 items-center justify-center px-3 text-sm";
  return (
    <nav aria-label="Pagination" className="my-6 flex justify-center">
      <ul className="flex overflow-hidden rounded-lg border border-az-border bg-white">
        <li className="border-r border-az-border">
          {page > 1 ? (
            <a href={link(page - 1)} className={`${cell} gap-1 hover:bg-[#f7fafa]`} rel="prev">
              <ChevronLeft className="size-4" aria-hidden="true" /> Previous
            </a>
          ) : (
            <span className={`${cell} gap-1 text-[#9a9a9a]`} aria-disabled="true">
              <ChevronLeft className="size-4" aria-hidden="true" /> Previous
            </span>
          )}
        </li>
        {pages.map((p, k) =>
          p === "gap" ? (
            <li key={`g${k}`} className={`${cell} hidden text-az-muted sm:flex`} aria-hidden="true">
              …
            </li>
          ) : (
            <li key={p} className={p === page ? "" : "hidden sm:block"}>
              {p === page ? (
                <span aria-current="page" className={`${cell} m-[-1px] border border-az-text font-bold`}>
                  {p}
                </span>
              ) : (
                <a href={link(p)} className={`${cell} hover:bg-[#f7fafa]`}>
                  {p}
                </a>
              )}
            </li>
          ),
        )}
        <li className="border-l border-az-border">
          {page < lastPage ? (
            <a href={link(page + 1)} className={`${cell} gap-1 hover:bg-[#f7fafa]`} rel="next">
              Next <ChevronRight className="size-4" aria-hidden="true" />
            </a>
          ) : (
            <span className={`${cell} gap-1 text-[#9a9a9a]`} aria-disabled="true">
              Next <ChevronRight className="size-4" aria-hidden="true" />
            </span>
          )}
        </li>
      </ul>
    </nav>
  );
}
