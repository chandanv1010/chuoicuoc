import { notFound } from "next/navigation";
import { getCurrentLanguage } from "@/lib/language";
import { authorize } from "@/server/auth";
import { converSlideArray, findSlide, itemsOf } from "@/modules/slide/slide";
import { SlideStore } from "@/modules/slide/slide-store";

/** GET /slide/{id}/edit — SlideController@edit (authorize 'slide.edit' nhu ban goc) */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await authorize("slide.edit");
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const slide = await findSlide(BigInt(id));
  if (!slide) notFound();
  const language = await getCurrentLanguage();
  const slideItem = converSlideArray(itemsOf(slide.item, language.id));
  return <SlideStore method="edit" slide={slide} slideItem={slideItem} />;
}
