import { notFound } from "next/navigation";
import { authorize } from "@/server/auth";
import { findPermission } from "@/modules/user/service";
import { PermissionDelete } from "@/modules/user/views";

/** GET /permission/{id}/delete — PermissionController@delete */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await authorize("permission.destroy");
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const permission = await findPermission(BigInt(id));
  if (!permission) notFound();
  return <PermissionDelete permission={permission} />;
}
