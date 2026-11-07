import { forbidden, notFound } from "next/navigation";
import { rootLocked } from "@/modules/system/site-type";
import { authorize } from "@/server/auth";
import { findUser, provinces, userCatalogueOptions } from "@/modules/user/service";
import { UserStore } from "@/modules/user/views";

/** GET /user/{id}/edit — UserController@edit */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const admin = await authorize("user.update");
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  // Tai khoan goc: chi chinh no moi mo duoc trang sua
  if (await rootLocked(admin.email, id)) forbidden();
  const [user, list, catalogues] = await Promise.all([findUser(BigInt(id)), provinces(), userCatalogueOptions()]);
  if (!user) notFound();
  return <UserStore method="edit" user={user} provinces={list} catalogues={catalogues} />;
}
