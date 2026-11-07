import { notFound } from "next/navigation";
import { DeleteConfirm, PageHeader } from "@/components/admin/page";
import { authorize } from "@/server/auth";
import { findCustomer } from "@/modules/customer/customer";

/** GET /customer/{id}/delete — CustomerController@delete (customer/customer/delete.blade.php) */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await authorize("customer.destroy");
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const customer = await findCustomer(BigInt(id));
  if (!customer) notFound();
  return (
    <>
      <PageHeader title="Xóa khách hàng" crumbs={[{ label: "Quản lý khách hàng", href: "/customer/index" }, { label: "Xóa" }]} />
      <DeleteConfirm action={`/customer/${id}/destroy`} name={`${customer.name} (${customer.email ?? ""})`} title="Xóa khách hàng" backHref="/customer/index" />
    </>
  );
}
