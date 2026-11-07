import { notFound } from "next/navigation";
import { getCurrentLanguage } from "@/lib/language";
import { authorize } from "@/server/auth";
import { findLanguage } from "@/modules/language/service";
import { descriptionMap, findWidget } from "@/modules/widget/service";
import { WidgetTranslate } from "@/modules/widget/views";

/**
 * GET /widget/{languageId}/{id}/translate — WidgetController@translate.
 * (Segment dau dat ten [id] vi Next.js bat buoc trung ten voi widget/[id]/edit; o day no la languageId.)
 */
export default async function Page({ params }: { params: Promise<{ id: string; widgetId: string }> }) {
  await authorize("widget.translate");
  const { id: languageId, widgetId } = await params;
  if (!/^\d+$/.test(languageId) || !/^\d+$/.test(widgetId)) notFound();
  const [widget, translate, current] = await Promise.all([findWidget(BigInt(widgetId)), findLanguage(BigInt(languageId)), getCurrentLanguage()]);
  if (!widget || !translate) notFound();
  const desc = descriptionMap(widget.description);
  const description = typeof desc === "string" ? desc : String(desc[current.id.toString()] ?? "");
  const translateDescription = typeof desc === "object" ? String(desc[languageId] ?? "") : "";
  return (
    <WidgetTranslate
      translate={translate}
      widget={{ id: widget.id, name: widget.name, description }}
      translateDescription={translateDescription}
    />
  );
}
