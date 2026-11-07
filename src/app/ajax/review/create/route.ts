import { laravelJson } from "@/modules/product/ajax";
import { ajaxInput } from "@/modules/frontend/shop/ajax";
import { PhpException } from "@/modules/frontend/shop/php";
import { createReview } from "@/modules/frontend/shop/review";

/** POST /ajax/review/create — Ajax\ReviewController@create (ReviewService::create). */
export async function POST(req: Request) {
  const input = await ajaxInput(req);
  try {
    return laravelJson(await createReview(input));
  } catch (e) {
    // DB::rollBack(); echo $e->getMessage(); die();
    if (e instanceof PhpException) return new Response(e.message, { headers: { "content-type": "text/html; charset=UTF-8" } });
    throw e;
  }
}
