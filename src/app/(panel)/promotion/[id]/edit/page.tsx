import { notFound } from "next/navigation";
import { authorize } from "@/server/auth";
import { allSources, convertData, findPromotion } from "@/modules/promotion/promotion";
import { PromotionStore } from "@/modules/promotion/promotion-store";

/** GET /promotion/{id}/edit — PromotionController@edit */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await authorize("promotion.update");
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const promotion = await findPromotion(BigInt(id));
  if (!promotion) notFound(); // findOrFail
  const [sources, products, productGifts] = await Promise.all([
    allSources(),
    convertData(promotion.id, "products"),
    convertData(promotion.id, "product_gifts"),
  ]);
  return <PromotionStore method="edit" promotion={promotion} sources={sources} products={products} productGifts={productGifts} />;
}
