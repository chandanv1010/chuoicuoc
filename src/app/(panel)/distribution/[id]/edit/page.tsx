import { notFound } from "next/navigation";
import { authorize } from "@/server/auth";
import { findAreaByParentId, findDistribution } from "@/modules/distribution/distribution";
import { DistributionStore } from "@/modules/distribution/distribution-store";

/** GET /distribution/{id}/edit — DistributionController@edit */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await authorize("distribution.update");
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const distribution = await findDistribution(BigInt(id));
  if (!distribution) notFound();
  const regions = await findAreaByParentId(0);
  return <DistributionStore method="edit" distribution={distribution} regions={regions} />;
}
