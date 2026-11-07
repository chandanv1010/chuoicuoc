import { notFound } from "next/navigation";
import { getCurrentLanguage } from "@/lib/language";
import { authorize } from "@/server/auth";
import { danhSachBaiViet, findFeature } from "@/modules/home-feature/home-feature";
import { FeatureStore } from "@/modules/home-feature/feature-store";

/** GET /home-feature/{id}/edit — HomeFeatureController@edit */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await authorize("home.feature.update");
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const feature = await findFeature(BigInt(id));
  if (!feature) notFound();
  const language = await getCurrentLanguage();
  return <FeatureStore method="edit" feature={feature} baiViet={await danhSachBaiViet(language.id)} />;
}
