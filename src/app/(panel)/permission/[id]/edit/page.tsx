import { notFound } from "next/navigation";
import { authorize } from "@/server/auth";
import { findPermission } from "@/modules/user/service";
import { PermissionStore } from "@/modules/user/views";

/** GET /permission/{id}/edit — PermissionController@edit */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await authorize("permission.update");
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const permission = await findPermission(BigInt(id));
  if (!permission) notFound();
  return <PermissionStore method="edit" permission={permission} />;
}
