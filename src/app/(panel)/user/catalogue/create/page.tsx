import { authorize } from "@/server/auth";
import { UserCatalogueStore } from "@/modules/user/views";

/** GET /user/catalogue/create — UserCatalogueController@create */
export default async function Page() {
  await authorize("user.catalogue.create");
  return <UserCatalogueStore method="create" userCatalogue={null} />;
}
