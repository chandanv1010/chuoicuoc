import { notFound } from "next/navigation";
import { authorize } from "@/server/auth";
import { findUserCatalogue } from "@/modules/user/service";
import { UserCatalogueStore } from "@/modules/user/views";

/** GET /user/catalogue/{id}/edit — UserCatalogueController@edit (findOrFail -> 404) */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await authorize("user.catalogue.update");
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const userCatalogue = await findUserCatalogue(BigInt(id));
  if (!userCatalogue) notFound();
  return <UserCatalogueStore method="edit" userCatalogue={userCatalogue} />;
}
