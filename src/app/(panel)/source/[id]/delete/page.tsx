import { notFound } from "next/navigation";
import { DeleteConfirm, PageHeader } from "@/components/admin/page";
import { __ } from "@/lib/lang";
import { authorize } from "@/server/auth";
import { findSource } from "@/modules/customer/customer";

/** GET /source/{id}/delete — SourceController@delete (source/delete.blade.php) */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await authorize("source.destroy");
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const source = await findSource(BigInt(id));
  if (!source) notFound();
  const seo = __<Record<string, { title: string }>>("messages.source");
  return (
    <>
      <PageHeader title="Xóa nguồn khách" crumbs={[{ label: seo.index.title, href: "/source/index" }, { label: "Xóa" }]} />
      <DeleteConfirm action={`/source/${id}/destroy`} name={source.name} title="Xóa nguồn khách" backHref="/source/index" />
    </>
  );
}
