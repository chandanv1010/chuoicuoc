import { notFound } from "next/navigation";
import { authorize } from "@/server/auth";
import { findSource } from "@/modules/customer/customer";
import { SourceStore } from "@/modules/customer/source-store";

/** GET /source/{id}/edit — SourceController@edit */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await authorize("source.update");
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const source = await findSource(BigInt(id));
  if (!source) notFound();
  return <SourceStore method="edit" source={source} />;
}
