import { authorize } from "@/server/auth";
import { SourceStore } from "@/modules/customer/source-store";

/** GET /source/create — SourceController@create */
export default async function Page() {
  await authorize("source.create");
  return <SourceStore method="create" source={null} />;
}
