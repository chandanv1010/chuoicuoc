import { notFound } from "next/navigation";
import { getCurrentLanguage } from "@/lib/language";
import { authorize } from "@/server/auth";
import { getPostById } from "@/modules/post/post";
import { postCatalogueNested } from "@/modules/post/post-catalogue";
import { PostStore } from "@/modules/post/post-store";

/** GET /post/{id}/edit — PostController@edit */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await authorize("post.update");
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const language = await getCurrentLanguage();
  const [post, dropdown] = await Promise.all([getPostById(BigInt(id), language.id), postCatalogueNested(language.id).dropdown()]);
  if (!post) notFound();
  return <PostStore method="edit" post={post} dropdown={dropdown} />;
}
