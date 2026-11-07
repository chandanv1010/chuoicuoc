import { notFound } from "next/navigation";
import { __ } from "@/lib/lang";
import { getCurrentLanguage } from "@/lib/language";
import { authorize } from "@/server/auth";
import { modelMeta } from "@/modules/language/model-meta";
import { findLanguage, getObjectById } from "@/modules/language/service";
import { LanguageTranslate } from "@/modules/language/views";

export const metadata = { title: "Dịch nội dung" };

/**
 * GET /language/{id}/{languageId}/{model}/translate — LanguageController@translate.
 * Ban Laravel hien tai loi 500 (respositoryInstance() tim \App\Repositories\{Model}Repository
 * khong ton tai); o day chay dung y do: doc ban ghi o ngon ngu hien tai va ngon ngu dich
 * qua bang <snake_model>_language, dung cho moi model co bang nay.
 */
export default async function Page({ params }: { params: Promise<{ id: string; languageId: string; model: string }> }) {
  const { id, languageId, model } = await params;
  if (!/^\d+$/.test(id) || !/^\d+$/.test(languageId)) notFound();
  await authorize("language.translate");
  if (!(await modelMeta(model))) notFound();
  const current = await getCurrentLanguage();
  const [object, objectTranslate, target] = await Promise.all([
    getObjectById(model, BigInt(id), current.id),
    getObjectById(model, BigInt(id), BigInt(languageId)),
    findLanguage(BigInt(languageId)),
  ]);
  const labels = __<Record<string, string>>("module.model");
  return (
    <LanguageTranslate
      option={{ id, languageId, model }}
      object={object}
      objectTranslate={objectTranslate}
      modelLabel={(typeof labels === "object" && labels[model]) || "bản ghi"}
      target={target ? { name: target.name, image: target.image } : null}
      current={{ name: current.name }}
    />
  );
}
