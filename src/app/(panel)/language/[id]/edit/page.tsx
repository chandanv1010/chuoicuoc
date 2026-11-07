import { notFound } from "next/navigation";
import { authorize } from "@/server/auth";
import { findLanguage } from "@/modules/language/service";
import { LanguageStore } from "@/modules/language/views";

/** GET /language/{id}/edit — LanguageController@edit */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await authorize("language.update");
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const language = await findLanguage(BigInt(id));
  if (!language) notFound();
  return <LanguageStore method="edit" language={language} />;
}
