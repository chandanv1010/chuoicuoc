import { notFound } from "next/navigation";
import { DeleteConfirm, PageHeader } from "@/components/admin/page";
import { __ } from "@/lib/lang";
import { authorize } from "@/server/auth";
import { findPromotion } from "@/modules/promotion/promotion";

/** GET /promotion/{id}/delete — PromotionController@delete (promotion/promotion/delete.blade.php) */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await authorize("promotion.destroy");
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const promotion = await findPromotion(BigInt(id));
  if (!promotion) notFound();
  const seo = __<Record<string, { title: string }>>("messages.promotion");
  return (
    <>
      <PageHeader title="Xóa khuyến mại" crumbs={[{ label: seo.index.title, href: "/promotion/index" }, { label: "Xóa" }]} />
      <DeleteConfirm action={`/promotion/${id}/destroy`} name={promotion.name} backHref="/promotion/index">
        <p className="text-muted-foreground">
          Mã khuyến mại: <span className="font-mono text-foreground">{promotion.code}</span>
        </p>
      </DeleteConfirm>
    </>
  );
}
