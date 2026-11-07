import { notFound } from "next/navigation";
import { DeleteConfirm, PageHeader } from "@/components/admin/page";
import { __ } from "@/lib/lang";
import { authorize } from "@/server/auth";
import { findReview } from "@/modules/review/review";

/** GET /review/{id}/delete — ReviewController@delete (review/delete.blade.php). Xoa cung. */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await authorize("review.destroy");
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const review = await findReview(BigInt(id));
  if (!review) notFound();
  const seo = __<Record<string, { title: string }>>("messages.review");
  return (
    <>
      <PageHeader title="Xóa đánh giá" crumbs={[{ label: seo.index.title, href: "/review/index" }, { label: "Xóa" }]} />
      <DeleteConfirm action={`/review/${id}/destroy`} name={`${review.fullname} — ${review.email}`} title="Xóa đánh giá" backHref="/review/index">
        {review.description && <blockquote className="border-l-2 pl-3 text-muted-foreground italic">{review.description}</blockquote>}
      </DeleteConfirm>
    </>
  );
}
