import { notFound } from "next/navigation";
import { getCurrentLanguage } from "@/lib/language";
import { authorize } from "@/server/auth";
import { attributeCatalogueNested, getAttributeCatalogueById } from "@/modules/attribute/attribute-catalogue";
import { AttributeCatalogueStore } from "@/modules/attribute/store";

export const metadata = { title: "Cập nhật loại thuộc tính" };

/** GET /attribute/catalogue/{id}/edit — AttributeCatalogueController@edit */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await authorize("attribute.catalogue.update");
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const language = await getCurrentLanguage();
  const [attributeCatalogue, dropdown] = await Promise.all([
    getAttributeCatalogueById(BigInt(id), language.id),
    attributeCatalogueNested(language.id).dropdown("Không có (gốc)"),
  ]);
  // ban goc: null -> loi 500 khi doc ->id
  if (!attributeCatalogue) notFound();
  return <AttributeCatalogueStore method="edit" attributeCatalogue={attributeCatalogue} dropdown={dropdown} />;
}
