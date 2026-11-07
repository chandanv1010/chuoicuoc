import { findProduct } from "@/modules/promotion/ajax";

/** GET ajax/dashboard/findProduct — Ajax\DashboardController@findProduct (middleware locale, khong can dang nhap) */
export async function GET(req: Request) {
  return findProduct(req);
}
