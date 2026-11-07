import { authorize } from "@/server/auth";
import { allSources } from "@/modules/promotion/promotion";
import { PromotionStore } from "@/modules/promotion/promotion-store";

/** GET /promotion/create — PromotionController@create */
export default async function Page() {
  await authorize("promotion.create");
  const sources = await allSources();
  return <PromotionStore method="create" promotion={null} sources={sources} products={null} productGifts={null} />;
}
