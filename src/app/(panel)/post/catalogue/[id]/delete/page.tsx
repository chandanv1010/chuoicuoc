import { notFound } from "next/navigation";
import { DeleteConfirm, PageHeader } from "@/components/admin/page";
import { __ } from "@/lib/lang";
import { getCurrentLanguage } from "@/lib/language";
import { authorize } from "@/server/auth";
import { getPostCatalogueById } from "@/modules/post/post-catalogue";

/** GET /post/catalogue/{id}/delete — PostCatalogueController@delete */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await authorize("post.catalogue.destroy");
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const language = await getCurrentLanguage();
  const postCatalogue = await getPostCatalogueById(BigInt(id), language.id);
  if (!postCatalogue) notFound();
  const seo = __<Record<string, { title: string }>>("messages.postCatalogue");
  return (
    <>
      <PageHeader title="Xóa nhóm bài viết" crumbs={[{ label: seo.index.title, href: "/post/catalogue/index" }, { label: "Xóa" }]} />
      <DeleteConfirm action={`/post/catalogue/${id}/destroy`} name={postCatalogue.name} backHref="/post/catalogue/index" />
    </>
  );
}
