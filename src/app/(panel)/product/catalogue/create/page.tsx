import { getCurrentLanguage } from "@/lib/language";
import { authorize } from "@/server/auth";
import { ProductCatalogueStore } from "@/modules/product/catalogue-store";
import { productCatalogueNested } from "@/modules/product/product-catalogue";

export const metadata = { title: "Thêm danh mục sản phẩm" };

/** GET /product/catalogue/create — ProductCatalogueController@create */
export default async function Page() {
  await authorize("product.catalogue.create");
  const language = await getCurrentLanguage();
  const dropdown = await productCatalogueNested(language.id).dropdown("Không có (gốc)");
  return <ProductCatalogueStore method="create" productCatalogue={null} dropdown={dropdown} />;
}
