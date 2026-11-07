import { notFound } from "next/navigation";
import { URL_SUFFIX } from "@/lib/constants";
import { findRouter, ROUTER_CONTROLLERS } from "@/modules/frontend/core";
import { queryFromSearchParams, resolvePage } from "@/modules/frontend/paginator";
import { PostCatalogueView } from "./post-catalogue-view";
import { PostView } from "./post-view";
import { ProductCatalogueView } from "./product-catalogue-view";
import { ProductView } from "./product-view";
import { getPageDoc } from "@/modules/builder/pages";
import { BuiltPage } from "@/modules/builder/page-view";
import type { PageKind } from "@/modules/builder/schema";

const PAGE_KIND_OF: Record<string, PageKind> = {
  [ROUTER_CONTROLLERS.product]: "product",
  [ROUTER_CONTROLLERS.productCatalogue]: "catalogue",
  [ROUTER_CONTROLLERS.post]: "post",
  [ROUTER_CONTROLLERS.postCatalogue]: "postcat",
};

/**
 * RouterController@index / @page: tra bang routers theo canonical (language 1)
 * roi goi dung controller frontend. Route Laravel:
 *   {canonical}.html             where canonical [a-zA-Z0-9-]+
 *   {canonical}/page-{page}.html where page [0-9]+
 */
export type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const CANONICAL = /^[a-zA-Z0-9-]+$/;

/** "/may-loc-nuoc.html" -> "may-loc-nuoc"; khong dung dang -> null */
export function parseCanonical(slug: string): string | null {
  const s = decodeURIComponent(slug);
  if (!s.endsWith(URL_SUFFIX)) return null;
  const c = s.slice(0, -URL_SUFFIX.length);
  return CANONICAL.test(c) ? c : null;
}

/** "page-2.html" -> "2" (chuoi, giong tham so route Laravel) */
export function parsePageSegment(seg: string): string | null {
  const m = decodeURIComponent(seg).match(/^page-([0-9]+)\.html$/);
  return m ? m[1] : null;
}

export async function RouterPage({
  canonical,
  pageParam,
  searchParams,
}: {
  canonical: string;
  /** null: route router.index; chuoi: router.page */
  pageParam: string | null;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const router = await findRouter(canonical);
  if (!router) notFound();

  const query = queryFromSearchParams(searchParams);
  // router.page: $request->merge(['page' => $page]) -> page nam trong query string
  if (pageParam !== null) {
    const i = query.findIndex(([k]) => k === "page");
    if (i >= 0) query[i] = ["page", pageParam];
    else query.push(["page", pageParam]);
  }
  const page = pageParam === null ? 1 : resolvePage(pageParam);

  // Trinh dung giao dien: trang nay co thiet ke rieng / loai trang co template da xuat ban -> dung ban do
  const kind = PAGE_KIND_OF[router.controllers];
  if (kind) {
    const doc = await getPageDoc(kind, router.module_id);
    if (doc) return <BuiltPage doc={doc} kind={kind} id={router.module_id} page={page} query={query} />;
  }

  switch (router.controllers) {
    case ROUTER_CONTROLLERS.productCatalogue:
      return <ProductCatalogueView catalogueId={router.module_id} page={page} query={query} />;
    case ROUTER_CONTROLLERS.product:
      return <ProductView productId={router.module_id} />;
    case ROUTER_CONTROLLERS.postCatalogue:
      return (
        <PostCatalogueView catalogueId={router.module_id} page={page} featuredFirst={pageParam === null} query={query} />
      );
    case ROUTER_CONTROLLERS.post:
      return <PostView postId={router.module_id} />;
    default:
      // Ban goc: app($controllers) loi -> 500. Ta tra 404.
      notFound();
  }
}
