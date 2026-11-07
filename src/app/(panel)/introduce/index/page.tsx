import { __ } from "@/lib/lang";
import { getCurrentLanguage } from "@/lib/language";
import { INTRODUCE_CONFIG } from "@/modules/introduce/config";
import { ConfigForm } from "@/modules/system/config-form";
import { readKeywordTable } from "@/modules/system/service";

/** GET /introduce/index — IntroduceController@index (introduce/index.blade.php, khong authorize) */
export default async function Page() {
  const language = await getCurrentLanguage();
  const introduces = await readKeywordTable("introduces", language.id);
  return (
    <ConfigForm
      title={__("messages.introduce.create.title")}
      action="/introduce/store"
      translateBase="/introduce"
      indexHref="/introduce/index"
      schema={INTRODUCE_CONFIG}
      values={introduces}
      languageId={language.id}
    />
  );
}
