import { Field } from "@/components/admin/fields";
import { SeoScorePanel } from "@/components/admin/seo-score";
import { AdminForm, AlbumSection, ContentSection, FormErrors, PageHeader, PublishSection, Section, SeoSection } from "@/components/admin/page";
import { Combobox } from "@/components/ui/combobox";
import { oldInput } from "@/lib/flash";
import { __ } from "@/lib/lang";
import type { PostCatalogueDetail } from "./post-catalogue";

/** resources/views/backend/post/catalogue/store.blade.php (+ component/aside.blade.php) */
export async function PostCatalogueStore({
  method,
  postCatalogue,
  dropdown,
}: {
  method: "create" | "edit";
  postCatalogue: PostCatalogueDetail | null;
  dropdown: [string, string][];
}) {
  const old = await oldInput();
  const seo = __<Record<string, { title: string }>>("messages.postCatalogue");
  const url = method === "create" ? "/post/catalogue/store" : `/post/catalogue/${postCatalogue?.id}/update`;
  const parentId = String(old("parent_id", postCatalogue?.parent_id ?? "0"));

  return (
    <>
      <PageHeader title={seo[method].title} crumbs={[{ label: seo.index.title, href: "/post/catalogue/index" }, { label: seo[method].title }]} />
      <FormErrors />
      <AdminForm
        action={url}
        cancelHref="/post/catalogue/index"
        autoCanonical={!postCatalogue?.name}
        main={
          <>
            <ContentSection model={postCatalogue} />
            <AlbumSection album={postCatalogue?.album} />
            <SeoSection model={postCatalogue} />
          </>
        }
        aside={
          <>
            <SeoScorePanel />
            <Section title="Danh mục cha" description={__("messages.parentNotice")}>
              <Field>
                <Combobox name="parent_id" defaultValue={parentId} options={dropdown.map(([value, label]) => ({ value, label }))} />
              </Field>
            </Section>
            <PublishSection model={postCatalogue} />
          </>
        }
      />
    </>
  );
}
