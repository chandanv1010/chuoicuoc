import { authorize } from "@/server/auth";
import { WidgetStore } from "@/modules/widget/views";

/** GET /widget/create — WidgetController@create */
export default async function Page() {
  await authorize("widget.create");
  return <WidgetStore method="create" widget={null} widgetItem={null} />;
}
