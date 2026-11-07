import { notFound } from "next/navigation";
import { getCurrentLanguage } from "@/lib/language";
import type { SearchParams } from "@/server/admin-list";
import { authorize } from "@/server/auth";
import { ProductCatalogueStore } from "@/modules/product/catalogue-store";
import { getProductCatalogueById, productCatalogueNested } from "@/modules/product/product-catalogue";
import { queryStringOf } from "@/modules/product/query-string";

export const metadata = { title: "Cập nhật danh mục sản phẩm" };

/** GET /product/catalogue/{id}/edit — ProductCatalogueController@edit */
export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> }) {
  await authorize("product.catalogue.update");
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const language = await getCurrentLanguage();
  const [productCatalogue, dropdown] = await Promise.all([
    getProductCatalogueById(BigInt(id), language.id),
    productCatalogueNested(language.id).dropdown("Không có (gốc)"),
  ]);
  // ban goc: $productCatalogue null -> loi 500 khi doc ->id
  if (!productCatalogue) notFound();
  return (
    <ProductCatalogueStore method="edit" productCatalogue={productCatalogue} dropdown={dropdown} queryUrl={queryStringOf(await searchParams)} />
  );
}
