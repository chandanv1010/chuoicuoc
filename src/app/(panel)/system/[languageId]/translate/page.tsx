import { notFound } from "next/navigation";
import { __ } from "@/lib/lang";
import { SYSTEM_CONFIG } from "@/modules/system/config";
import { ConfigForm } from "@/modules/system/config-form";
import { readKeywordTable } from "@/modules/system/service";

/** GET /system/{languageId}/translate — SystemController@translate */
export default async function Page({ params }: { params: Promise<{ languageId: string }> }) {
  const { languageId } = await params;
  if (!/^\d+$/.test(languageId)) notFound();
  const systems = await readKeywordTable("systems", BigInt(languageId));
  return (
    <ConfigForm
      title={__("messages.system.create.title")}
      action={`/system/${languageId}/saveTranslate`}
      translateBase="/system"
      indexHref="/system/index"
      schema={SYSTEM_CONFIG}
      values={systems}
      languageId={BigInt(languageId)}
      translating
    />
  );
}
