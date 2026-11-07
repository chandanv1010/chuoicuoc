import { forbidden, notFound } from "next/navigation";
import { rootLocked } from "@/modules/system/site-type";
import { authorize } from "@/server/auth";
import { findUser } from "@/modules/user/service";
import { UserDelete } from "@/modules/user/views";

/** GET /user/{id}/delete — UserController@delete */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const admin = await authorize("user.destroy");
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  // Tai khoan goc: chi chinh no moi mo duoc trang xoa
  if (await rootLocked(admin.email, id)) forbidden();
  const user = await findUser(BigInt(id));
  if (!user) notFound();
  return <UserDelete user={user} />;
}
