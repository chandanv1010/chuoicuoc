import { notFound } from "next/navigation";
import { DeleteConfirm, PageHeader } from "@/components/admin/page";
import { __ } from "@/lib/lang";
import { authorize } from "@/server/auth";
import { findSlide } from "@/modules/slide/slide";

/** GET /slide/{id}/delete — SlideController@delete (view backend/slide/delete.blade.php) */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await authorize("slide.destroy");
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const slide = await findSlide(BigInt(id));
  if (!slide) notFound();
  const seo = __<Record<string, { title: string }>>("messages.slide");
  return (
    <>
      <PageHeader title="Xóa slide" crumbs={[{ label: seo.index.title, href: "/slide/index" }, { label: "Xóa" }]} />
      <DeleteConfirm action={`/slide/${slide.id}/destroy`} name={slide.name} title="Xóa slide" backHref="/slide/index" />
    </>
  );
}
