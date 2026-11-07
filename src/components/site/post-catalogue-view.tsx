/* eslint-disable @next/next/no-img-element -- anh qua route /thumb */
import { notFound } from "next/navigation";
import { FRONTEND_LANGUAGE } from "@/modules/frontend/core";
import { plainText, seo, strLimit } from "@/modules/frontend/helpers";
import { thumbUrl } from "@/modules/frontend/image";
import { getPostCatalogueById, paginatePosts, type PostCard } from "@/modules/frontend/post";
import { usDate } from "@/modules/frontend/store";
import { siteName } from "@/lib/site";
import { getPostMeta, type PostMeta } from "./news-data";
import { Pager } from "./pager";
import { MaybeFrame } from "./site-frame";

/**
 * Chuyen muc bai viet / blog (PostCatalogueController@index), giao dien "tap chi":
 * trang 1 co bai noi bat lon o dau, sau do luoi the bai viet + phan trang
 * (/<canonical>.html, /<canonical>/page-N.html).
 * paginatePosts chi tra bai da xuat ban (publish=2).
 */
export async function PostCatalogueView({
  catalogueId,
  page,
  featuredFirst = false,
  query,
  bare,
}: {
  catalogueId: bigint;
  page: number;
  featuredFirst?: boolean;
  query: [string, string][];
  bare?: boolean;
}) {
  const language = FRONTEND_LANGUAGE;
  const catalogue = await getPostCatalogueById(catalogueId, language);
  if (!catalogue) notFound();
  const posts = await paginatePosts({ query, languageId: language, catalogue, page, path: catalogue.canonical ?? "" });
  // Bai dang qua form admin chua co released_at: sap theo ngay dang thuc te (released_at, roi created_at)
  const items = [...posts.items].sort((a, b) => dateOf(b) - dateOf(a) || Number(b.id - a.id));
  const [meta, shop] = await Promise.all([getPostMeta(items.map((p) => p.id)), siteName()]);
  const featured = featuredFirst && page === 1 ? (items[0] ?? null) : null;
  const rest = featured ? items.slice(1) : items;

  return (
    <MaybeFrame bare={bare} seo={seo(catalogue, page)}>
      <header className="bg-az-bg">
        <div className="mx-auto max-w-[1200px] px-4 pt-8 pb-7 sm:pt-10">
          <p className="text-xs font-semibold tracking-[0.18em] text-az-cart uppercase">The {shop} journal</p>
          <h1 className="mt-2 font-display text-[34px] leading-[1.1] font-semibold sm:text-[44px]">{catalogue.name}</h1>
          {catalogue.description ? <p className="mt-3 max-w-2xl text-[15px] leading-6 text-az-muted">{plainText(catalogue.description)}</p> : null}
          <span className="stitch mt-5 block h-[2px] w-28 text-az-cart/60" aria-hidden="true" />
        </div>
      </header>

      <div className="mx-auto max-w-[1200px] px-4 py-8">
        {items.length === 0 ? (
          <div className="rounded-2xl border border-az-border bg-az-cream px-6 py-12 text-center">
            <span className="stitch mx-auto block h-[2px] w-16 text-az-cart/60" aria-hidden="true" />
            <p className="mt-5 font-display text-2xl font-semibold">Bài viết sẽ sớm được cập nhật</p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-az-muted">
              We are writing our first posts — news, tips and gift ideas. In the meantime, take a look around the shop.
            </p>
            <a href="/products.html" className="az-btn az-btn-cart mt-6 px-6 py-2 text-sm">
              Shop all products
            </a>
          </div>
        ) : (
          <>
            {featured && <FeaturedPost post={featured} meta={meta.get(String(featured.id))} />}
            {rest.length > 0 && (
              <section aria-labelledby="latest-h" className={featured ? "mt-12" : ""}>
                <div className="mb-5 flex items-center gap-4">
                  <h2 id="latest-h" className="font-display text-2xl font-semibold">
                    {featured ? "Bài viết khác" : "Tin tức"}
                  </h2>
                  <span className="stitch h-[2px] flex-1 text-az-border" aria-hidden="true" />
                </div>
                <ul className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
                  {rest.map((p) => (
                    <li key={String(p.id)}>
                      <PostCardItem post={p} meta={meta.get(String(p.id))} />
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
        <Pager base={`/${catalogue.canonical}`} page={page} lastPage={posts.lastPage} query={query.filter(([k]) => k !== "page")} />
      </div>
    </MaybeFrame>
  );
}

type CardPost = Pick<PostCard, "id" | "image" | "name" | "canonical" | "description" | "released_at" | "created_at">;

function dateOf(p: Pick<PostCard, "released_at" | "created_at">) {
  return (p.released_at ?? p.created_at)?.getTime() ?? 0;
}

/** "Oct 25, 2026 · 5 min read" */
export function PostMetaLine({ date, minutes, className = "" }: { date: Date | null; minutes?: number; className?: string }) {
  if (!date && !minutes) return null;
  return (
    <p className={`flex flex-wrap items-center gap-x-2 text-xs text-az-muted ${className}`}>
      {date && <time dateTime={date.toISOString()}>{usDate(date)}</time>}
      {date && minutes ? <span aria-hidden="true">·</span> : null}
      {minutes ? <span>{minutes} phút đọc</span> : null}
    </p>
  );
}

export function TopicChip({ topic }: { topic: string | null | undefined }) {
  if (!topic) return null;
  return (
    <span className="inline-flex items-center rounded-full bg-az-header/[0.08] px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-az-header uppercase">
      {topic}
    </span>
  );
}

function FeaturedPost({ post, meta }: { post: CardPost; meta?: PostMeta }) {
  const href = `/${post.canonical}.html`;
  return (
    <article className="group relative grid overflow-hidden rounded-2xl bg-az-cream shadow-[0_1px_3px_rgba(60,45,30,0.12)] md:grid-cols-[1.15fr_1fr]">
      {/* Anh tuyet doi tren desktop: chieu cao the theo cot chu, anh khong keo dai the */}
      <div className="relative aspect-[4/3] overflow-hidden bg-az-bg md:aspect-auto md:min-h-[400px]">
        {post.image && (
          <img
            src={thumbUrl(post.image, 900)}
            alt=""
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        )}
      </div>
      <div className="flex flex-col justify-center p-6 sm:p-8 lg:p-10">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold tracking-[0.18em] text-az-cart uppercase">Nổi bật</span>
          <TopicChip topic={meta?.topic} />
        </div>
        <h2 className="mt-3 font-display text-[26px] leading-[1.15] font-semibold sm:text-[34px]">
          {/* after:absolute: ca the la vung bam, nhung chi tieu de la link (doc ro cho trinh doc man hinh) */}
          <a href={href} className="after:absolute after:inset-0 group-hover:text-az-link-hover">
            {post.name}
          </a>
        </h2>
        {post.description && <p className="mt-3 line-clamp-4 text-[15px] leading-6 text-az-text/80">{strLimit(plainText(post.description), 260)}</p>}
        <PostMetaLine date={post.released_at ?? post.created_at} minutes={meta?.minutes} className="mt-4" />
        <span className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-az-link group-hover:text-az-link-hover" aria-hidden="true">
          Read the story <span>→</span>
        </span>
      </div>
    </article>
  );
}

/** The bai viet trong luoi (dung lai o "More stories" cua trang chi tiet). */
export function PostCardItem({ post, meta }: { post: CardPost; meta?: PostMeta }) {
  const href = `/${post.canonical}.html`;
  return (
    <article className="group relative flex h-full flex-col">
      <div className="aspect-[4/3] overflow-hidden rounded-xl bg-az-bg">
        {post.image && (
          <img
            src={thumbUrl(post.image, 600)}
            alt=""
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
            loading="lazy"
          />
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <TopicChip topic={meta?.topic} />
      </div>
      <h3 className="mt-2 font-display text-[20px] leading-[1.25] font-semibold">
        <a href={href} className="after:absolute after:inset-0 group-hover:text-az-link-hover">
          {post.name}
        </a>
      </h3>
      {post.description && <p className="mt-2 line-clamp-3 text-sm leading-6 text-az-muted">{plainText(post.description)}</p>}
      <PostMetaLine date={post.released_at ?? post.created_at} minutes={meta?.minutes} className="mt-auto pt-3" />
    </article>
  );
}
