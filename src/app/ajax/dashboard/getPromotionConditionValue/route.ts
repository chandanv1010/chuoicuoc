import { getPromotionConditionValue } from "@/modules/promotion/ajax";

/** GET ajax/dashboard/getPromotionConditionValue — Ajax\DashboardController@getPromotionConditionValue */
export async function GET(req: Request) {
  return getPromotionConditionValue(req);
}
