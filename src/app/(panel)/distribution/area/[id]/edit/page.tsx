import { notFound } from "next/navigation";
import { authorize } from "@/server/auth";
import { findArea, findAreaByParentId } from "@/modules/distribution/distribution";
import { AreaStore } from "@/modules/distribution/area-store";

/** GET /distribution/area/{id}/edit — DistributionAreaController@edit */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await authorize("distribution.area.update");
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const [area, parents] = await Promise.all([findArea(BigInt(id)), findAreaByParentId(0)]);
  if (!area) notFound();
  return <AreaStore method="edit" area={area} parents={parents} />;
}
