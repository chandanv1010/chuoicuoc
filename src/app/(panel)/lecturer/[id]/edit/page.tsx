import { notFound } from "next/navigation";
import { authorize } from "@/server/auth";
import { findLecturer } from "@/modules/lecturer/service";
import { LecturerStore } from "@/modules/lecturer/views";

/** GET /lecturer/{id}/edit — LecturerController@edit */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await authorize("lecturer.update");
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const lecturer = await findLecturer(BigInt(id));
  if (!lecturer) notFound();
  return <LecturerStore method="edit" lecturer={lecturer} />;
}
