import { Field, FileUrlInput } from "@/components/admin/fields";
import { SeoScorePanel } from "@/components/admin/seo-score";
import { AdminForm, AlbumSection, ContentSection, FormErrors, PageHeader, PublishSection, Section, SeoSection } from "@/components/admin/page";
import { Combobox } from "@/components/ui/combobox";
import { Textarea } from "@/components/ui/form-controls";
import { errorBag, oldInput } from "@/lib/flash";
import { __ } from "@/lib/lang";
import { SocialHistorySection, SocialPublishSection } from "@/modules/social/social-block";
import type { getPostById } from "./post";

type Post = Awaited<ReturnType<typeof getPostById>>;

/** resources/views/backend/post/post/store.blade.php + component/aside.blade.php */
export async function PostStore({ method, post, dropdown }: { method: "create" | "edit"; post: Post; dropdown: [string, string][] }) {
  const [old, errors] = await Promise.all([oldInput(), errorBag()]);
  const seo = __<Record<string, { title: string }>>("messages.post");
  const url = method === "create" ? "/post/store" : `/post/${post?.id}/update`;
  const options = dropdown.map(([value, label]) => ({ value, label }));
  const mainCatalogue = String(old("post_catalogue_id", post?.post_catalogue_id ?? "0"));
  // Danh muc phu: tru danh muc chinh (giong dieu kien trong aside.blade.php)
  const subCatalogues = (old<string[] | undefined>("catalogue", undefined) ?? post?.catalogueIds ?? []).map(String).filter((k) => !post || k !== String(post.post_catalogue_id));

  return (
    <>
      <PageHeader title={seo[method].title} crumbs={[{ label: seo.index.title, href: "/post/index" }, { label: seo[method].title }]} />
      <FormErrors />
      <AdminForm
        action={url}
        cancelHref="/post/index"
        autoCanonical={!post?.name}
        main={
          <>
            <ContentSection model={post} />
            <AlbumSection album={post?.album} />
            <SeoSection model={post} />
            <SocialPublishSection sourceType="Post" item={post} />
          </>
        }
        aside={
          <>
            <SeoScorePanel />
            <Section title="Danh mục">
              <Field label="Danh mục chính" required error={errors.first("post_catalogue_id")}>
                <Combobox name="post_catalogue_id" defaultValue={mainCatalogue} options={options} />
              </Field>
              <Field label="Danh mục phụ">
                <Combobox name="catalogue[]" multiple defaultValue={subCatalogues} options={options.filter((o) => o.value !== "0")} placeholder="Chọn danh mục phụ" />
              </Field>
            </Section>
            <PublishSection model={post}>
              {/* recommend / post_type: Blade an di (class hidden) nhung van gui len */}
              <input type="hidden" name="recommend" value={String(old("recommend", post?.recommend ?? "1"))} />
              <input type="hidden" name="post_type" value={String(old("post_type", post?.post_type ?? "post"))} />
            </PublishSection>
            <Section title="Video" description="Chọn file video hoặc dán mã nhúng">
              <VideoField defaultValue={old("video", post?.video ?? "") ?? ""} />
            </Section>
          </>
        }
      />
      {post && <SocialHistorySection sourceType="Post" sourceId={post.id} />}
    </>
  );
}

/** Video Clip: chon file tu thu vien (Flash) hoac dan ma nhung vao o ben duoi. */
function VideoField({ defaultValue }: { defaultValue: string }) {
  const isEmbed = /<\s*iframe|<\s*video/i.test(defaultValue);
  return (
    <div className="grid gap-2">
      {isEmbed ? (
        <Textarea name="video" defaultValue={defaultValue} className="min-h-32 font-mono text-xs" />
      ) : (
        <FileUrlInput name="video" type="Flash" defaultValue={defaultValue} placeholder="Đường dẫn video hoặc mã nhúng" />
      )}
    </div>
  );
}
