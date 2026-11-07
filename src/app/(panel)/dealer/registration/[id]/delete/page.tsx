import { notFound } from "next/navigation";
import { DeleteConfirm, PageHeader } from "@/components/admin/page";
import { __ } from "@/lib/lang";
import { authorize } from "@/server/auth";
import { findRegistration } from "@/modules/dealer/dealer";

/** GET /dealer/registration/{id}/delete — DealerRegistrationController@delete */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await authorize("dealer.registration.destroy");
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const registration = await findRegistration(BigInt(id));
  if (!registration) notFound();
  const seo = __<Record<string, { title: string }>>("messages.dealerRegistration");
  return (
    <>
      <PageHeader title={seo.delete.title} crumbs={[{ label: seo.index.title, href: "/dealer/registration/index" }, { label: "Xóa" }]} />
      <DeleteConfirm
        action={`/dealer/registration/${registration.id}/destroy`}
        name={`${registration.name} — ${registration.phone}`}
        title={seo.delete.title}
        backHref="/dealer/registration/index"
      >
        <dl className="grid grid-cols-[90px_1fr] gap-1 rounded-md border bg-muted/30 p-3">
          <dt className="text-muted-foreground">Công ty</dt>
          <dd>{registration.company || "—"}</dd>
        </dl>
        <p className="text-destructive">
          Đây là thông tin khách hàng tự gửi. Nếu chỉ muốn dọn danh sách, hãy quay lại và đổi trạng thái thành <b>Không phù hợp</b> thay vì xóa — như vậy vẫn còn dữ liệu để
          đối chiếu về sau.
        </p>
      </DeleteConfirm>
    </>
  );
}
