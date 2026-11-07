import type { SearchParams } from "@/components/site/router-page";
import { ProductCatalogueView } from "@/components/site/product-catalogue-view";
import { queryFromSearchParams } from "@/modules/frontend/paginator";

/** GET /products.html — ProductCatalogueController@all (route product.all). */
export default async function AllProductsPage({ searchParams }: { searchParams: SearchParams }) {
  const query = queryFromSearchParams(await searchParams);
  return <ProductCatalogueView catalogueId={null} page={1} query={query} />;
}
