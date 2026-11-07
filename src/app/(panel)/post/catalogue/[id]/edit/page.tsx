import { notFound } from "next/navigation";
import { getCurrentLanguage } from "@/lib/language";
import { authorize } from "@/server/auth";
import { getPostCatalogueById, postCatalogueNested } from "@/modules/post/post-catalogue";
import { PostCatalogueStore } from "@/modules/post/catalogue-store";

/** GET /post/catalogue/{id}/edit — PostCatalogueController@edit */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await authorize("post.catalogue.update");
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const language = await getCurrentLanguage();
  const [postCatalogue, dropdown] = await Promise.all([
    getPostCatalogueById(BigInt(id), language.id),
    postCatalogueNested(language.id).dropdown(),
  ]);
  if (!postCatalogue) notFound();
  return <PostCatalogueStore method="edit" postCatalogue={postCatalogue} dropdown={dropdown} />;
}
