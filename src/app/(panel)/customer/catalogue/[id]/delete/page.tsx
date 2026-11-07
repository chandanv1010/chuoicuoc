import { notFound } from "next/navigation";
import { DeleteConfirm, PageHeader } from "@/components/admin/page";
import { __ } from "@/lib/lang";
import { authorize } from "@/server/auth";
import { findCustomerCatalogue } from "@/modules/customer/customer";

/** GET /customer/catalogue/{id}/delete — CustomerCatalogueController@delete (customer/catalogue/delete.blade.php) */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await authorize("customer.catalogue.destroy");
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const catalogue = await findCustomerCatalogue(BigInt(id));
  if (!catalogue) notFound();
  const seo = __<Record<string, { title: string }>>("messages.customerCatalogue");
  return (
    <>
      <PageHeader title={seo.delete.title} crumbs={[{ label: seo.index.title, href: "/customer/catalogue/index" }, { label: "Xóa" }]} />
      <DeleteConfirm action={`/customer/catalogue/${id}/destroy`} name={catalogue.name} title="Xóa nhóm khách hàng" backHref="/customer/catalogue/index" />
    </>
  );
}
