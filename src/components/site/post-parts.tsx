/* eslint-disable @next/next/no-img-element -- anh qua route /thumb */
import { FRONTEND_LANGUAGE } from "@/modules/frontend/core";
import { jsonDecode, phpTruthy, url } from "@/modules/frontend/helpers";
import { thumbUrl } from "@/modules/frontend/image";
import { getPostById, getPostCatalogueById, paginatePosts } from "@/modules/frontend/post";
import { getStoryProducts } from "./news-data";
import { Pager } from "./pager";
import { MiniCard } from "./product-card";
import { ProductRow } from "./product-row";
import { ShareLinks } from "./share-links";

/**
 * Cac phan cua trang bai viet / danh muc bai viet dat lam khoi trong template cua trinh dung giao dien
 * (tieu de, ngay, anh, tom tat dung {{truong}}; phan nay la noi dung, chia se, "Shop the story", phan trang).
 */
type P = { postId: bigint };

export async function PostBreadcrumb({ postId }: P) {
  const post = await getPostById(postId, FRONTEND_LANGUAGE);
  if (!post) return null;
  const catalogue = await getPostCatalogueById(BigInt(post.post_catalogue_id), FRONTEND_LANGUAGE);
  return (
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
            <a href={`/${catalogue.canonical}.html`} className="hover:text-az-link-hover hover:underline">
              {catalogue.name}
            </a>
          </li>
        )}
      </ol>
    </nav>
  );
}

/** Noi dung bai (HTML tu trinh soan thao) + album anh. */
export async function PostContent({ postId }: P) {
  const post = await getPostById(postId, FRONTEND_LANGUAGE);
  if (!post) return null;
  const decoded = jsonDecode<unknown>(post.album ?? "");
  const album = (decoded && typeof decoded === "object" ? Object.values(decoded as Record<string, unknown>) : []).filter(phpTruthy).map(String);
  return (
    <div>
      <div className="az-prose az-prose-article" dangerouslySetInnerHTML={{ __html: post.content || post.description || "" }} />
      {album.length > 0 && (
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {album.map((src, i) => (
            <img key={i} src={thumbUrl(src, 400)} alt="" className="aspect-square w-full rounded-lg object-cover" loading="lazy" />
          ))}
        </div>
      )}
    </div>
  );
}

export async function PostShare({ postId }: P) {
  const post = await getPostById(postId, FRONTEND_LANGUAGE);
  if (!post) return null;
  return <ShareLinks url={url(`/${post.canonical}.html`)} title={post.name} image={post.image ? url(post.image) : null} />;
}

/** San pham theo tu khoa trong meta_keyword cua bai (hoac ban chay). */
export async function PostShopStory({ postId }: P) {
  const post = await getPostById(postId, FRONTEND_LANGUAGE);
  if (!post) return null;
  const story = await getStoryProducts(post.meta_keyword);
  if (!story.products.length) return null;
  return (
    <ProductRow title="Sản phẩm trong bài" href={story.keyword ? `/products.html?keyword=${encodeURIComponent(story.keyword)}` : "/products.html"} linkLabel="Xem tất cả">
      {story.products.map((p) => (
        <MiniCard key={p.id} product={p} />
      ))}
    </ProductRow>
  );
}

/** Phan trang danh sach bai viet cua danh muc. */
export async function PostCataloguePager({ catalogueId, page, query }: { catalogueId: bigint; page: number; query: [string, string][] }) {
  const catalogue = await getPostCatalogueById(catalogueId, FRONTEND_LANGUAGE);
  if (!catalogue) return null;
  const posts = await paginatePosts({ query, languageId: FRONTEND_LANGUAGE, catalogue, page, path: catalogue.canonical ?? "" });
  return <Pager base={`/${catalogue.canonical}`} page={page} lastPage={posts.lastPage} query={query.filter(([k]) => k !== "page")} />;
}
