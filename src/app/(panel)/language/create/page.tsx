import { authorize } from "@/server/auth";
import { LanguageStore } from "@/modules/language/views";

/** GET /language/create — LanguageController@create */
export default async function Page() {
  await authorize("language.create");
  return <LanguageStore method="create" language={null} />;
}
