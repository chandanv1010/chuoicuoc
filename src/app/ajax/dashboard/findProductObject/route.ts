import { findProductObject } from "@/modules/promotion/ajax";

/** GET ajax/dashboard/findProductObject — Ajax\DashboardController@findProductObject (middleware locale) */
export async function GET(req: Request) {
  return findProductObject(req);
}
