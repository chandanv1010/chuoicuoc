import { loadProductPromotion } from "@/modules/promotion/ajax";

/** GET ajax/product/loadProductPromotion — Ajax\ProductController@loadProductPromotion (logic o module promotion). */
export async function GET(req: Request) {
  return loadProductPromotion(req);
}
