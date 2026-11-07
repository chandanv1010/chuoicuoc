import { getAdmin } from "@/server/auth";
import { orderChart } from "@/modules/order/order";

/** GET ajax/order/chart?chartType=1|7|30 — Ajax\OrderController@chart (OrderService::ajaxOrderChart). */
export async function GET(req: Request) {
  if (!(await getAdmin())) return Response.json({ message: "Unauthenticated." }, { status: 401 });
  const type = Number.parseInt(new URL(req.url).searchParams.get("chartType") ?? "", 10);
  const chart = await orderChart(type);
  // ban goc: chartType khac 1/7/30 -> "Undefined variable $response" (500)
  if (!chart) return Response.json({ message: "Undefined variable $response" }, { status: 500 });
  return Response.json(chart);
}
