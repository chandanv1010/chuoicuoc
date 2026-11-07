import { notFound } from "next/navigation";
import { DeleteConfirm, PageHeader } from "@/components/admin/page";
import { __ } from "@/lib/lang";
import { authorize } from "@/server/auth";
import { findDealer } from "@/modules/dealer/dealer";

/** GET /dealer/{id}/delete — DealerController@delete (view backend/dealer/delete.blade.php) */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await authorize("dealer.destroy");
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const dealer = await findDealer(BigInt(id));
  if (!dealer) notFound();
  const seo = __<Record<string, { title: string }>>("messages.dealer");
  return (
    <>
      <PageHeader title={seo.delete.title} crumbs={[{ label: seo.index.title, href: "/dealer/index" }, { label: "Xóa" }]} />
      <DeleteConfirm action={`/dealer/${dealer.id}/destroy`} name={dealer.name} title={seo.delete.title} backHref="/dealer/index">
        <dl className="grid grid-cols-[90px_1fr] gap-1 rounded-md border bg-muted/30 p-3">
          <dt className="text-muted-foreground">Điện thoại</dt>
          <dd>{dealer.phone || "—"}</dd>
          <dt className="text-muted-foreground">Địa chỉ</dt>
          <dd>{dealer.address || "—"}</dd>
        </dl>
        <p className="text-muted-foreground">Nếu chỉ muốn tạm ẩn khỏi bản đồ, hãy quay lại và tắt công tắc ở cột Tình trạng.</p>
      </DeleteConfirm>
    </>
  );
}
