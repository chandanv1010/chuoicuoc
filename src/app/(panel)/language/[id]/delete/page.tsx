import { notFound } from "next/navigation";
import { authorize } from "@/server/auth";
import { findLanguage } from "@/modules/language/service";
import { LanguageDelete } from "@/modules/language/views";

/** GET /language/{id}/delete — LanguageController@delete */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await authorize("language.destroy");
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const language = await findLanguage(BigInt(id));
  if (!language) notFound();
  return <LanguageDelete language={language} />;
}
