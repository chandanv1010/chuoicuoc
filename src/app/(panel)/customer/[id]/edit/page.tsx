import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { authorize } from "@/server/auth";
import { allCustomerCatalogues, allSources, findCustomer } from "@/modules/customer/customer";
import { CustomerStore } from "@/modules/customer/customer-store";

/** GET /customer/{id}/edit — CustomerController@edit */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await authorize("customer.update");
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const customer = await findCustomer(BigInt(id));
  if (!customer) notFound();
  const [provinces, customerCatalogues, sources] = await Promise.all([
    db.provinces.findMany({ select: { code: true, name: true } }),
    allCustomerCatalogues(),
    allSources(),
  ]);
  return <CustomerStore method="edit" customer={customer} provinces={provinces} customerCatalogues={customerCatalogues} sources={sources} />;
}
