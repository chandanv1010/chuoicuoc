import { notFound } from "next/navigation";
import { getCurrentLanguage } from "@/lib/language";
import type { SearchParams } from "@/server/admin-list";
import { authorize } from "@/server/auth";
import { getAllAttributeCatalogues } from "@/modules/attribute/attribute-catalogue";
import { getProductById } from "@/modules/product/product";
import { productCatalogueNested } from "@/modules/product/product-catalogue";
import { ProductStore } from "@/modules/product/product-store";
import { queryStringOf } from "@/modules/product/query-string";

export const metadata = { title: "Cập nhật sản phẩm" };

/** GET /product/{id}/edit — ProductController@edit */
export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> }) {
  await authorize("product.update");
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const language = await getCurrentLanguage();
  const [product, dropdown, attributeCatalogue] = await Promise.all([
    getProductById(BigInt(id), language.id),
    productCatalogueNested(language.id).dropdown("Chọn danh mục"),
    getAllAttributeCatalogues(language.id),
  ]);
  // ban goc: json_decode($product->album) tren null -> loi 500
  if (!product) notFound();
  return (
    <ProductStore
      method="edit"
      product={product}
      dropdown={dropdown}
      attributeCatalogue={attributeCatalogue}
      languageId={language.id}
      queryUrl={queryStringOf(await searchParams)}
    />
  );
}
