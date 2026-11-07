import { authorize } from "@/server/auth";
import { findAreaByParentId } from "@/modules/distribution/distribution";
import { AreaStore } from "@/modules/distribution/area-store";

/** GET /distribution/area/create — DistributionAreaController@create */
export default async function Page() {
  await authorize("distribution.area.create");
  const parents = await findAreaByParentId(0);
  return <AreaStore method="create" area={null} parents={parents} />;
}
