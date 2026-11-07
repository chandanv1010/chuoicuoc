/** Giong config('apps.general.suffix') ben Laravel. */
export const URL_SUFFIX = ".html";

/** Giong config('apps.general.publish'): 1 = khong xuat ban, 2 = xuat ban. */
export const PUBLISH = { OFF: 1, ON: 2 } as const;

/**
 * Bang `routers` luu ten class controller cua Laravel. Giu nguyen chuoi nay
 * de Laravel va Next.js dung chung mot database trong luc chuyen doi.
 */
export const CONTROLLERS = {
  postCatalogue: "App\\Http\\Controllers\\Frontend\\PostCatalogueController",
  post: "App\\Http\\Controllers\\Frontend\\PostController",
  productCatalogue: "App\\Http\\Controllers\\Frontend\\ProductCatalogueController",
  product: "App\\Http\\Controllers\\Frontend\\ProductController",
} as const;

/** Giong config("apps.general.follow"): 1 = follow, 2 = nofollow. */
export const FOLLOW = { FOLLOW: 1, NOFOLLOW: 2 } as const;

export const PER_PAGE = 12;

/** Ten shop du phong khi chua nhap systems.homepage_company (xem siteName() o ./site). */
export const SITE_NAME_FALLBACK = "Our store";

/**
 * Ten mien cua chinh site (APP_URL / PUBLIC_BASE_URL, khong co "www.") de bo qua link cua shop khi loc spam.
 * Chi co gia tri o server (env khong co NEXT_PUBLIC_); o client tra "".
 */
export function ownSiteHost(): string {
  const raw = (typeof process !== "undefined" && (process.env.PUBLIC_BASE_URL || process.env.APP_URL)) || "";
  try {
    return raw ? new URL(raw).hostname.replace(/^www\./, "") : "";
  } catch {
    return "";
  }
}

/** Regex khop link toi ten mien cua site + `extra` (vd etsy.com); khong cau hinh ten mien thi chi khop `extra`. */
export function ownLinkPattern(extra: string): RegExp {
  const host = ownSiteHost().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(host ? `${host}|${extra}` : extra, "i");
}
