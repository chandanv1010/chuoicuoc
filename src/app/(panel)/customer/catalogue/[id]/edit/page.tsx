import { notFound } from "next/navigation";
import { authorize } from "@/server/auth";
import { findCustomerCatalogue } from "@/modules/customer/customer";
import { CustomerCatalogueStore } from "@/modules/customer/catalogue-store";

/** GET /customer/catalogue/{id}/edit — CustomerCatalogueController@edit (findById -> 404) */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await authorize("customer.catalogue.update");
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const catalogue = await findCustomerCatalogue(BigInt(id));
  if (!catalogue) notFound();
  return <CustomerCatalogueStore method="edit" catalogue={catalogue} />;
}
