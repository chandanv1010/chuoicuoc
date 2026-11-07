import { getCurrentLanguage } from "@/lib/language";
import { authorize } from "@/server/auth";
import { attributeCatalogueNested } from "@/modules/attribute/attribute-catalogue";
import { AttributeStore } from "@/modules/attribute/store";

export const metadata = { title: "Thêm thuộc tính" };

/** GET /attribute/create — AttributeController@create */
export default async function Page() {
  await authorize("attribute.create");
  const language = await getCurrentLanguage();
  const dropdown = await attributeCatalogueNested(language.id).dropdown("Chọn loại thuộc tính");
  return <AttributeStore method="create" attribute={null} dropdown={dropdown} />;
}
