import { authorize } from "@/server/auth";
import { PermissionStore } from "@/modules/user/views";

/** GET /permission/create — PermissionController@create */
export default async function Page() {
  await authorize("permission.create");
  return <PermissionStore method="create" permission={null} />;
}
