import { URL_SUFFIX } from "@/lib/constants";
import { appUrl } from "./helpers";

/**
 * LengthAwarePaginator cua Laravel (phan ma view frontend dung) + duong dan
 * ->withQueryString()->withPath(env('APP_URL') . $path).
 */
export type Paginator<T> = {
  items: T[];
  total: number;
  perPage: number;
  currentPage: number;
  lastPage: number;
  /** Duong dan goc: APP_URL + path (vd http://host/may-loc-nuoc) */
  path: string;
  /** request()->query() — giu nguyen thu tu tham so */
  query: [string, string][];
};

/** Paginator::resolveCurrentPage + isValidPageNumber: so nguyen >= 1, sai thi ve 1. */
export function resolvePage(page: unknown): number {
  const s = String(page ?? "");
  if (!/^[+-]?\d+$/.test(s.trim())) return 1;
  const n = parseInt(s, 10);
  return n >= 1 ? n : 1;
}

export function makePaginator<T>(
  items: T[],
  total: number,
  perPage: number,
  currentPage: number,
  path: string,
  query: [string, string][],
): Paginator<T> {
  return {
    items,
    total,
    perPage,
    currentPage,
    lastPage: Math.max(Math.ceil(total / perPage), 1),
    path: `${appUrl()}${path}`,
    query,
  };
}

/** http_build_query(..., PHP_QUERY_RFC3986) */
function buildQuery(params: [string, string][]): string {
  const enc = (s: string) =>
    encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return params.map(([k, v]) => `${enc(k)}=${enc(v)}`).join("&");
}

/** $paginator->url($page): array_merge($query, ['page' => $page]) */
export function pageUrl(p: Paginator<unknown>, page: number): string {
  const params = p.query.map(([k, v]) => [k, v] as [string, string]);
  const idx = params.findIndex(([k]) => k === "page");
  if (idx >= 0) params[idx] = ["page", String(page)];
  else params.push(["page", String(page)]);
  return `${p.path}${p.path.includes("?") ? "&" : "?"}${buildQuery(params)}`;
}

export const hasPages = (p: Paginator<unknown>) => p.currentPage !== 1 || p.lastPage > p.currentPage;
export const previousPageUrl = (p: Paginator<unknown>) => (p.currentPage > 1 ? pageUrl(p, p.currentPage - 1) : null);
export const nextPageUrl = (p: Paginator<unknown>) => (p.lastPage > p.currentPage ? pageUrl(p, p.currentPage + 1) : null);

/**
 * waco-pagination.blade.php: doi "?page=" thanh "/page-" + .html, trang 1 bo
 * hau to. Khi co them tham so khac (vd ?sort=oldest&page=2) ban goc khong doi
 * duoc va sinh ra "...?sort=oldest&page=2.html" — giu nguyen hanh vi do.
 */
export function wacoPageLink(urlStr: string | null): string | null {
  if (!urlStr) return null;
  const u = urlStr.replaceAll("?page=", "/page-") + URL_SUFFIX;
  return u.replaceAll(`/page-1${URL_SUFFIX}`, URL_SUFFIX);
}

/** request()->query() tu searchParams cua Next (lay gia tri dau cho moi khoa). */
export function queryFromSearchParams(sp: Record<string, string | string[] | undefined>): [string, string][] {
  const out: [string, string][] = [];
  for (const [k, v] of Object.entries(sp)) {
    if (v === undefined) continue;
    out.push([k, Array.isArray(v) ? (v[v.length - 1] ?? "") : v]);
  }
  return out;
}
