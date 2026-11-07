import { notFound } from "next/navigation";
import { DeleteConfirm, PageHeader } from "@/components/admin/page";
import { __ } from "@/lib/lang";
import { authorize } from "@/server/auth";
import { findVoucher } from "@/modules/voucher/voucher";

/** GET /voucher/{id}/delete — VoucherController@delete (backend/voucher/delete.blade.php) */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await authorize("voucher.destroy");
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const voucher = await findVoucher(BigInt(id));
  if (!voucher) notFound();
  const seo = __<Record<string, { title: string }>>("messages.voucher");
  return (
    <>
      <PageHeader title={seo.delete.title} crumbs={[{ label: seo.index.title, href: "/voucher/index" }, { label: "Xóa" }]} />
      <DeleteConfirm action={`/voucher/${id}/destroy`} name={voucher.name} backHref="/voucher/index">
        <p className="text-muted-foreground">
          Mã voucher: <span className="font-mono text-foreground">{voucher.code}</span>
        </p>
      </DeleteConfirm>
    </>
  );
}
