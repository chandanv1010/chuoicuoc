import { getCurrentLanguage } from "@/lib/language";
import { authorize } from "@/server/auth";
import { postCatalogueNested } from "@/modules/post/post-catalogue";
import { PostCatalogueStore } from "@/modules/post/catalogue-store";

/** GET /post/catalogue/create — PostCatalogueController@create */
export default async function Page() {
  await authorize("post.catalogue.create");
  const language = await getCurrentLanguage();
  const dropdown = await postCatalogueNested(language.id).dropdown();
  return <PostCatalogueStore method="create" postCatalogue={null} dropdown={dropdown} />;
}
