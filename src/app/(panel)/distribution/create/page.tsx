import { authorize } from "@/server/auth";
import { findAreaByParentId } from "@/modules/distribution/distribution";
import { DistributionStore } from "@/modules/distribution/distribution-store";

/** GET /distribution/create — DistributionController@create */
export default async function Page() {
  await authorize("distribution.create");
  const regions = await findAreaByParentId(0);
  return <DistributionStore method="create" distribution={null} regions={regions} />;
}
