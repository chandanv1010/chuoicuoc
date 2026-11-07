import { getCurrentLanguage } from "@/lib/language";
import { authorize } from "@/server/auth";
import { danhSachBaiViet } from "@/modules/home-feature/home-feature";
import { FeatureStore } from "@/modules/home-feature/feature-store";

/** GET /home-feature/create — HomeFeatureController@create */
export default async function Page() {
  await authorize("home.feature.create");
  const language = await getCurrentLanguage();
  return <FeatureStore method="create" feature={null} baiViet={await danhSachBaiViet(language.id)} />;
}
