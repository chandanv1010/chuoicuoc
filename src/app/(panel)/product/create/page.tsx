import { getCurrentLanguage } from "@/lib/language";
import { authorize } from "@/server/auth";
import { getAllAttributeCatalogues } from "@/modules/attribute/attribute-catalogue";
import { productCatalogueNested } from "@/modules/product/product-catalogue";
import { ProductStore } from "@/modules/product/product-store";

export const metadata = { title: "Thêm sản phẩm" };

/** GET /product/create — ProductController@create */
export default async function Page() {
  await authorize("product.create");
  const language = await getCurrentLanguage();
  const [dropdown, attributeCatalogue] = await Promise.all([
    productCatalogueNested(language.id).dropdown("Chọn danh mục"),
    getAllAttributeCatalogues(language.id),
  ]);
  return <ProductStore method="create" product={null} dropdown={dropdown} attributeCatalogue={attributeCatalogue} languageId={language.id} />;
}
