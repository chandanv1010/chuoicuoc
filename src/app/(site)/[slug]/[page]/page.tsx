import { notFound } from "next/navigation";
import { parsePageSegment, RouterPage, type SearchParams } from "@/components/site/router-page";
import { ProductCatalogueView } from "@/components/site/product-catalogue-view";
import { queryFromSearchParams, resolvePage } from "@/modules/frontend/paginator";

/**
 * GET /{canonical}/page-{page}.html — RouterController@page (route router.page)
 * va GET /products/page-{page}.html — ProductCatalogueController@all (product.all.page).
 */
export default async function CanonicalPagedPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; page: string }>;
  searchParams: SearchParams;
}) {
  const { slug, page } = await params;
  const canonical = decodeURIComponent(slug);
  const pageParam = parsePageSegment(page);
  if (pageParam === null || !/^[a-zA-Z0-9-]+$/.test(canonical)) notFound();

  if (canonical === "products") {
    // Route rieng khai bao truoc route dong; $page la tham so route, khong merge vao query.
    const query = queryFromSearchParams(await searchParams);
    return <ProductCatalogueView catalogueId={null} page={resolvePage(pageParam)} query={query} />;
  }
  return <RouterPage canonical={canonical} pageParam={pageParam} searchParams={await searchParams} />;
}
