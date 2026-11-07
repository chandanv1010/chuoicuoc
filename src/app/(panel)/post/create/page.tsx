import { getCurrentLanguage } from "@/lib/language";
import { authorize } from "@/server/auth";
import { postCatalogueNested } from "@/modules/post/post-catalogue";
import { PostStore } from "@/modules/post/post-store";

/** GET /post/create — PostController@create */
export default async function Page() {
  await authorize("post.create");
  const language = await getCurrentLanguage();
  const dropdown = await postCatalogueNested(language.id).dropdown();
  return <PostStore method="create" post={null} dropdown={dropdown} />;
}
