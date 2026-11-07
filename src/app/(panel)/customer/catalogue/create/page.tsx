import { authorize } from "@/server/auth";
import { CustomerCatalogueStore } from "@/modules/customer/catalogue-store";

/** GET /customer/catalogue/create — CustomerCatalogueController@create */
export default async function Page() {
  await authorize("customer.catalogue.create");
  return <CustomerCatalogueStore method="create" catalogue={null} />;
}
