import { notFound } from "next/navigation";
import { __ } from "@/lib/lang";
import { INTRODUCE_CONFIG } from "@/modules/introduce/config";
import { ConfigForm } from "@/modules/system/config-form";
import { readKeywordTable } from "@/modules/system/service";

/** GET /introduce/{languageId}/translate — IntroduceController@translate */
export default async function Page({ params }: { params: Promise<{ languageId: string }> }) {
  const { languageId } = await params;
  if (!/^\d+$/.test(languageId)) notFound();
  const introduces = await readKeywordTable("introduces", BigInt(languageId));
  return (
    <ConfigForm
      title={__("messages.introduce.create.title")}
      action={`/introduce/${languageId}/saveTranslate`}
      translateBase="/introduce"
      indexHref="/introduce/index"
      schema={INTRODUCE_CONFIG}
      values={introduces}
      languageId={BigInt(languageId)}
      translating
    />
  );
}
