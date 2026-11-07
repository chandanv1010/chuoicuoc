import { authorize } from "@/server/auth";
import { SlideStore } from "@/modules/slide/slide-store";

/** GET /slide/create — SlideController@create */
export default async function Page() {
  await authorize("slide.create");
  return <SlideStore method="create" slide={null} slideItem={null} />;
}
