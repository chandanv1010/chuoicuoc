/* eslint-disable @next/next/no-img-element -- anh qua route /thumb */
import { notFound } from "next/navigation";
import { FRONTEND_LANGUAGE } from "@/modules/frontend/core";
import { jsonDecode, phpTruthy, plainText, seo, url } from "@/modules/frontend/helpers";
import { thumbUrl } from "@/modules/frontend/image";
import { getPostById, getPostCatalogueById, incrementViewed } from "@/modules/frontend/post";
import { getMoreStories, getPostDate, getPostMeta, getStoryProducts, readingMinutes, topicOf } from "./news-data";
import { PostCardItem, PostMetaLine, TopicChip } from "./post-catalogue-view";
import { MiniCard } from "./product-card";
import { ProductRow } from "./product-row";
import { ShareLinks } from "./share-links";
import { MaybeFrame } from "./site-frame";

/**
 * Bai viet (PostController@index), bo cuc doc bai kieu tap chi: tieu de Fraunces, ngay dang +
 * thoi gian doc, anh lon, cot chu ~720px, chia se, "Shop the story" (san pham theo tu khoa
 * trong meta_keyword hoac ban chay) va "More stories". Van tang luot xem moi lan mo trang.
 */
/** preview: xem truoc trong trinh dung giao dien — khong tang luot xem. */
export async function PostView({ postId, bare, preview }: { postId: bigint; bare?: boolean; preview?: boolean }) {
  const language = FRONTEND_LANGUAGE;
  const post = await getPostById(postId, language);
  if (!post) notFound();
  if (!preview) await incrementViewed(post.id);
  const [catalogue, more, date, story] = await Promise.all([
    getPostCatalogueById(BigInt(post.post_catalogue_id), language),
    getMoreStories(post.id, post.post_catalogue_id),
    getPostDate(post.id),
    getStoryProducts(post.meta_keyword),
  ]);
  const moreMeta = await getPostMeta(more.map((p) => p.id));
  const decoded = jsonDecode<unknown>(post.album ?? "");
  const album = (decoded && typeof decoded === "object" ? Object.values(decoded as Record<string, unknown>) : []).filter(phpTruthy).map(String);
  const html = post.content || post.description || "";
  const minutes = readingMinutes(html);
  const topic = topicOf(post.meta_keyword);
  const pageUrl = url(`/${post.canonical}.html`);
  const lead = plainText(post.description);
  const listHref = catalogue?.canonical ? `/${catalogue.canonical}.html` : "/news.html";

  return (
    <MaybeFrame bare={bare} seo={seo(post)}>
      <article>
        <header className="bg-az-bg">
          <div className={`mx-auto max-w-[760px] px-4 pt-6 ${post.image ? "pb-24 sm:pb-32" : "pb-10"}`}>
            <nav aria-label="Breadcrumb" className="text-xs text-az-muted">
              <ol className="flex flex-wrap items-center gap-1">
                <li>
                  <a href="/" className="hover:text-az-link-hover hover:underline">
                    Home
                  </a>
                </li>
                {catalogue?.canonical && (
                  <li className="flex items-center gap-1">
                    <span aria-hidden="true">›</span>
                    <a href={listHref} className="hover:text-az-link-hover hover:underline">
                      {catalogue.name}
                    </a>
                  </li>
                )}
              </ol>
            </nav>
            <div className="mt-6">
              <TopicChip topic={topic} />
            </div>
            <h1 className="mt-3 font-display text-[32px] leading-[1.12] font-semibold text-balance sm:text-[44px]">{post.name}</h1>
            {lead && <p className="mt-4 text-[17px] leading-7 text-az-text/80">{lead}</p>}
            <PostMetaLine date={date} minutes={minutes} className="mt-5 text-[13px]" />
            <span className="stitch mt-5 block h-[2px] w-24 text-az-cart/60" aria-hidden="true" />
          </div>
        </header>

        {post.image && (
          <div className="mx-auto -mt-20 max-w-[1040px] px-4 sm:-mt-28">
            <img
              src={thumbUrl(post.image, 1100)}
              alt=""
              className="aspect-[4/3] w-full rounded-2xl object-cover shadow-[0_8px_24px_rgba(60,45,30,0.16)] sm:aspect-[16/9]"
            />
          </div>
        )}

        <div className="mx-auto max-w-[720px] px-4 pt-8 pb-10 sm:pt-10">
          <div className="az-prose az-prose-article" dangerouslySetInnerHTML={{ __html: html }} />
          {album.length > 0 && (
            <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {album.map((src, i) => (
                <img key={i} src={thumbUrl(src, 400)} alt="" className="aspect-square w-full rounded-lg object-cover" loading="lazy" />
              ))}
            </div>
          )}
          <footer className="mt-10 border-t border-az-border pt-6">
            <ShareLinks url={pageUrl} title={post.name} image={post.image ? url(post.image) : null} />
          </footer>
        </div>
      </article>

      {story.products.length > 0 && (
        <div className="bg-az-bg px-0 py-8 sm:px-4">
          <div className="mx-auto max-w-[1200px] overflow-hidden sm:rounded-2xl">
            <ProductRow
              title="Sản phẩm trong bài"
              href={story.keyword ? `/products.html?keyword=${encodeURIComponent(story.keyword)}` : "/products.html"}
              linkLabel="Xem tất cả"
            >
              {story.products.map((p) => (
                <MiniCard key={p.id} product={p} />
              ))}
            </ProductRow>
          </div>
        </div>
      )}

      {more.length > 0 && (
        <section className="mx-auto max-w-[1200px] px-4 py-10" aria-labelledby="more-h">
          <div className="mb-6 flex items-center gap-4">
            <h2 id="more-h" className="font-display text-2xl font-semibold">
              Bài viết khác
            </h2>
            <span className="stitch h-[2px] flex-1 text-az-border" aria-hidden="true" />
            <a href={listHref} className="az-link shrink-0 text-sm font-medium">
              All stories
            </a>
          </div>
          <ul className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {more.map((p) => (
              <li key={String(p.id)}>
                <PostCardItem post={p} meta={moreMeta.get(String(p.id))} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </MaybeFrame>
  );
}
