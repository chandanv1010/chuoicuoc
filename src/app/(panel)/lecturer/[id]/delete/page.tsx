import { notFound } from "next/navigation";
import { authorize } from "@/server/auth";
import { findLecturer } from "@/modules/lecturer/service";
import { LecturerDelete } from "@/modules/lecturer/views";

/** GET /lecturer/{id}/delete — LecturerController@delete */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await authorize("lecturer.destroy");
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const lecturer = await findLecturer(BigInt(id));
  if (!lecturer) notFound();
  return <LecturerDelete lecturer={lecturer} />;
}
