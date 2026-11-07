import { authorize } from "@/server/auth";
import { provinces, userCatalogueOptions } from "@/modules/user/service";
import { UserStore } from "@/modules/user/views";

/** GET /user/create — UserController@create */
export default async function Page() {
  await authorize("user.create");
  const [list, catalogues] = await Promise.all([provinces(), userCatalogueOptions()]);
  return <UserStore method="create" user={null} provinces={list} catalogues={catalogues} />;
}
