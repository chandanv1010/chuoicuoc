import { notFound } from "next/navigation";
import { DeleteConfirm, PageHeader } from "@/components/admin/page";
import { __ } from "@/lib/lang";
import { getCurrentLanguage } from "@/lib/language";
import { authorize } from "@/server/auth";
import { getAttributeById } from "@/modules/attribute/attribute";

export const metadata = { title: "Xóa thuộc tính" };

/** GET /attribute/{id}/delete — AttributeController@delete */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await authorize("attribute.destroy");
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const language = await getCurrentLanguage();
  const attribute = await getAttributeById(BigInt(id), language.id);
  if (!attribute) notFound();
  const seo = __<Record<string, { title: string }>>("messages.attribute");
  return (
    <>
      <PageHeader title="Xóa thuộc tính" crumbs={[{ label: seo.index.title, href: "/attribute/index" }, { label: "Xóa" }]} />
      <DeleteConfirm action={`/attribute/${id}/destroy`} name={attribute.name} backHref="/attribute/index">
        <input type="hidden" name="name" value={attribute.name ?? ""} />
      </DeleteConfirm>
    </>
  );
}
