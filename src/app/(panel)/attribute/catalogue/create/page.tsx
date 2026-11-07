import { getCurrentLanguage } from "@/lib/language";
import { authorize } from "@/server/auth";
import { attributeCatalogueNested } from "@/modules/attribute/attribute-catalogue";
import { AttributeCatalogueStore } from "@/modules/attribute/store";

export const metadata = { title: "Thêm loại thuộc tính" };

/** GET /attribute/catalogue/create — AttributeCatalogueController@create */
export default async function Page() {
  await authorize("attribute.catalogue.create");
  const language = await getCurrentLanguage();
  const dropdown = await attributeCatalogueNested(language.id).dropdown("Không có (gốc)");
  return <AttributeCatalogueStore method="create" attributeCatalogue={null} dropdown={dropdown} />;
}
