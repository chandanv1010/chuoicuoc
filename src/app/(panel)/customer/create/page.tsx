import { db } from "@/lib/db";
import { authorize } from "@/server/auth";
import { allCustomerCatalogues, allSources } from "@/modules/customer/customer";
import { CustomerStore } from "@/modules/customer/customer-store";

/** GET /customer/create — CustomerController@create */
export default async function Page() {
  await authorize("customer.create");
  const [provinces, customerCatalogues, sources] = await Promise.all([
    db.provinces.findMany({ select: { code: true, name: true } }),
    allCustomerCatalogues(),
    allSources(),
  ]);
  return <CustomerStore method="create" customer={null} provinces={provinces} customerCatalogues={customerCatalogues} sources={sources} />;
}
