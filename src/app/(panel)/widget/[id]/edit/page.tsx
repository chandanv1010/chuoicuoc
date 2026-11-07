import { notFound } from "next/navigation";
import { getCurrentLanguage } from "@/lib/language";
import { authorize } from "@/server/auth";
import { widgetItems } from "@/modules/widget/model-object";
import { descriptionMap, findWidget, jsonOf } from "@/modules/widget/service";
import { WidgetStore } from "@/modules/widget/views";

/** GET /widget/{id}/edit — WidgetController@edit */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await authorize("widget.update");
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const widget = await findWidget(BigInt(id));
  if (!widget) notFound();
  const language = await getCurrentLanguage();
  const desc = descriptionMap(widget.description);
  const description = typeof desc === "string" ? desc : String(desc[language.id.toString()] ?? "");
  const modelIds = jsonOf(widget.model_id);
  // $widget->model_id != null -> convertArrayByKey(findByCondition(... whereIn id ...))
  const ids = modelIds !== null && modelIds !== undefined ? (Array.isArray(modelIds) ? modelIds : [modelIds]).map(String) : null;
  const raw = ids ? await widgetItems(widget.model, ids, language.id) : null;
  // Hien theo thu tu da luu trong model_id (giao dien moi cho keo tha sap xep); ban goc theo id DESC
  let widgetItem = raw;
  if (raw && ids) {
    const order = raw.id.map((_, i) => i).sort((a, b) => ids.indexOf(raw.id[a]) - ids.indexOf(raw.id[b]));
    widgetItem = { id: order.map((i) => raw.id[i]), name: order.map((i) => raw.name[i]), image: order.map((i) => raw.image[i]) };
  }
  return (
    <WidgetStore
      method="edit"
      widget={{
        id: widget.id,
        name: widget.name,
        keyword: widget.keyword,
        short_code: widget.short_code,
        note: widget.note,
        model: widget.model,
        album: widget.album,
        description,
      }}
      widgetItem={widgetItem}
    />
  );
}
