import { __ } from "@/lib/lang";
import { getCurrentLanguage } from "@/lib/language";
import { SYSTEM_CONFIG } from "@/modules/system/config";
import { ConfigForm } from "@/modules/system/config-form";
import { readKeywordTable } from "@/modules/system/service";

/** GET /system/index — SystemController@index (controller goc khong authorize) */
export default async function Page() {
  const language = await getCurrentLanguage();
  const systems = await readKeywordTable("systems", language.id);
  return (
    <ConfigForm
      title={__("messages.system.create.title")}
      action="/system/store"
      translateBase="/system"
      indexHref="/system/index"
      schema={SYSTEM_CONFIG}
      values={systems}
      languageId={language.id}
    />
  );
}
