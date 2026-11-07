import { loadProductVoucher } from "@/modules/promotion/ajax";

/** GET ajax/product/loadProductVoucher — Ajax\ProductController@loadProductVoucher (logic o module promotion). */
export async function GET(req: Request) {
  return loadProductVoucher(req);
}
