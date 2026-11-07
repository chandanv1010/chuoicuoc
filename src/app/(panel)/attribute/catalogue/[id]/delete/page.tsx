import { notFound } from "next/navigation";
import { DeleteConfirm, PageHeader } from "@/components/admin/page";
import { __ } from "@/lib/lang";
import { getCurrentLanguage } from "@/lib/language";
import { authorize } from "@/server/auth";
import { getAttributeCatalogueById } from "@/modules/attribute/attribute-catalogue";

export const metadata = { title: "Xóa loại thuộc tính" };

/** GET /attribute/catalogue/{id}/delete — AttributeCatalogueController@delete */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await authorize("attribute.catalogue.destroy");
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const language = await getCurrentLanguage();
  const attributeCatalogue = await getAttributeCatalogueById(BigInt(id), language.id);
  if (!attributeCatalogue) notFound();
  const seo = __<Record<string, { title: string }>>("messages.attributeCatalogue");
  return (
    <>
      <PageHeader
        title={seo.delete?.title ?? "Xóa loại thuộc tính"}
        crumbs={[{ label: seo.index.title, href: "/attribute/catalogue/index" }, { label: "Xóa" }]}
      />
      <DeleteConfirm action={`/attribute/catalogue/${id}/destroy`} name={attributeCatalogue.name} backHref="/attribute/catalogue/index">
        {/* DeleteAttributeCatalogueRequest kiem tra loai con tren truong name */}
        <input type="hidden" name="name" value={attributeCatalogue.name ?? ""} />
      </DeleteConfirm>
    </>
  );
}
