import { notFound } from "next/navigation";
import { authorize } from "@/server/auth";
import { findUserCatalogue } from "@/modules/user/service";
import { UserCatalogueDelete } from "@/modules/user/views";

/** GET /user/catalogue/{id}/delete — UserCatalogueController@delete */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await authorize("user.catalogue.destroy");
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const userCatalogue = await findUserCatalogue(BigInt(id));
  if (!userCatalogue) notFound();
  return <UserCatalogueDelete userCatalogue={userCatalogue} />;
}
