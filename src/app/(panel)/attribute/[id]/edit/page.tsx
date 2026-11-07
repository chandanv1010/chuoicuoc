import { notFound } from "next/navigation";
import { getCurrentLanguage } from "@/lib/language";
import type { SearchParams } from "@/server/admin-list";
import { authorize } from "@/server/auth";
import { getAttributeById } from "@/modules/attribute/attribute";
import { attributeCatalogueNested } from "@/modules/attribute/attribute-catalogue";
import { AttributeStore } from "@/modules/attribute/store";
import { queryStringOf } from "@/modules/product/query-string";

export const metadata = { title: "Cập nhật thuộc tính" };

/** GET /attribute/{id}/edit — AttributeController@edit */
export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> }) {
  await authorize("attribute.update");
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const language = await getCurrentLanguage();
  const [attribute, dropdown] = await Promise.all([getAttributeById(BigInt(id), language.id), attributeCatalogueNested(language.id).dropdown("Chọn loại thuộc tính")]);
  // ban goc: json_decode($attribute->album) tren null -> loi 500
  if (!attribute) notFound();
  return <AttributeStore method="edit" attribute={attribute} dropdown={dropdown} queryUrl={queryStringOf(await searchParams)} />;
}
