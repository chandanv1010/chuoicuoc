import { notFound } from "next/navigation";
import { authorize } from "@/server/auth";
import { findWidget } from "@/modules/widget/service";
import { WidgetDelete } from "@/modules/widget/views";

/** GET /widget/{id}/delete — WidgetController@delete */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await authorize("widget.destroy");
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const widget = await findWidget(BigInt(id));
  if (!widget) notFound();
  return <WidgetDelete widget={widget} />;
}
