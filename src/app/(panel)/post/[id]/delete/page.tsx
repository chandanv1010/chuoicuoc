import { notFound } from "next/navigation";
import { DeleteConfirm, PageHeader } from "@/components/admin/page";
import { __ } from "@/lib/lang";
import { getCurrentLanguage } from "@/lib/language";
import { authorize } from "@/server/auth";
import { getPostById } from "@/modules/post/post";

/** GET /post/{id}/delete — PostController@delete */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await authorize("post.destroy");
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const language = await getCurrentLanguage();
  const post = await getPostById(BigInt(id), language.id);
  if (!post) notFound();
  const seo = __<Record<string, { title: string }>>("messages.post");
  return (
    <>
      <PageHeader title="Xóa bài viết" crumbs={[{ label: seo.index.title, href: "/post/index" }, { label: "Xóa" }]} />
      <DeleteConfirm action={`/post/${id}/destroy`} name={post.name} backHref="/post/index" />
    </>
  );
}
