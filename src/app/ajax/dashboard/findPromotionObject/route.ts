import { findPromotionObject } from "@/modules/promotion/ajax";

/** GET ajax/dashboard/findPromotionObject — Ajax\DashboardController@findPromotionObject */
export async function GET(req: Request) {
  return findPromotionObject(req);
}
