import { authorize } from "@/server/auth";
import { LecturerStore } from "@/modules/lecturer/views";

/** GET /lecturer/create — LecturerController@create */
export default async function Page() {
  await authorize("lecturer.create");
  return <LecturerStore method="create" lecturer={null} />;
}
