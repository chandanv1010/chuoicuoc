import "server-only";
import { Prisma } from "@prisma/client";
import { cache } from "react";
import { db } from "@/lib/db";
import { now } from "@/lib/helpers";
import { addslashes } from "./helpers";
import { makePaginator, type Paginator } from "./paginator";
import { phpInt } from "./product";

/**
 * Phan doc du lieu bai viet cho website, thay:
 *   - PostCatalogueRepository::getPostCatalogueById
 *   - PostRepository::getPostById
 *   - PostService::paginate (+ whereRaw)
 *   - tabs / related trong PostCatalogueController, PostController
 */

export type PostCatalogue = {
  id: bigint;
  parent_id: number;
  lft: number;
  rgt: number;
  image: string | null;
  name: string;
  description: string | null;
  content: string | null;
  meta_title: string | null;
  meta_keyword: string | null;
  meta_description: string | null;
  canonical: string | null;
};

export const getPostCatalogueById = cache(async (id: bigint, languageId: bigint) => {
  const rows = await db.$queryRaw<PostCatalogue[]>`
    SELECT pc.id, pc.parent_id, pc.lft, pc.rgt, pc.image,
           tb2.name, tb2.description, tb2.content, tb2.meta_title, tb2.meta_keyword, tb2.meta_description, tb2.canonical
    FROM post_catalogues pc
    JOIN post_catalogue_language tb2 ON tb2.post_catalogue_id = pc.id
    WHERE tb2.language_id = ${languageId} AND pc.id = ${id} AND pc.deleted_at IS NULL
    LIMIT 1`;
  return rows[0] ?? null;
});

export type PostCard = {
  id: bigint;
  image: string | null;
  created_at: Date | null;
  released_at: Date | null;
  viewed: number;
  name: string;
  description: string | null;
  canonical: string | null;
};

/**
 * PostService::paginate(..., ['posts.released_at', 'desc']) cho trang chuyen muc:
 * 15 bai/trang. Da sua: ban goc khong loc publish (bai da tat van hien) — storefront chi hien publish=2.
 */
export async function paginatePosts(opts: {
  query: [string, string][];
  languageId: bigint;
  catalogue: { id: bigint };
  page: number;
  path: string;
}): Promise<Paginator<PostCard>> {
  const perPage = 15;
  const q = new Map(opts.query);
  const keyword = addslashes(q.get("keyword") ?? "");
  const publish = 2;
  const reqCat = phpInt(q.get("post_catalogue_id"));
  const catId = reqCat > 0 ? BigInt(reqCat) : opts.catalogue.id;

  const conds: Prisma.Sql[] = [];
  if (keyword !== "") conds.push(Prisma.sql`tb2.name LIKE ${`%${keyword}%`}`);
  if (publish) conds.push(Prisma.sql`posts.publish = ${publish}`);
  conds.push(Prisma.sql`tb2.language_id = ${opts.languageId}`);
  conds.push(Prisma.sql`tb3.post_catalogue_id IN (
    SELECT id FROM post_catalogues
    JOIN post_catalogue_language ON post_catalogues.id = post_catalogue_language.post_catalogue_id
    WHERE lft >= (SELECT lft FROM post_catalogues as pc WHERE pc.id = ${catId})
      AND rgt <= (SELECT rgt FROM post_catalogues as pc WHERE pc.id = ${catId})
      AND post_catalogue_language.language_id = ${opts.languageId}
  )`);
  conds.push(Prisma.sql`posts.deleted_at IS NULL`);

  const from = Prisma.sql`
    FROM posts
    JOIN post_language as tb2 ON tb2.post_id = posts.id
    JOIN post_catalogue_post as tb3 ON posts.id = tb3.post_id
    WHERE ${Prisma.join(conds, " AND ")}`;
  const group = Prisma.sql`GROUP BY posts.id, posts.image, posts.created_at, posts.released_at, posts.viewed, tb2.name, tb2.description, tb2.canonical`;

  const [count] = await db.$queryRaw<{ total: bigint }[]>`
    SELECT COUNT(*) AS total FROM (SELECT posts.id ${from} ${group}) AS aggregate_table`;
  const total = Number(count?.total ?? 0);
  const items = await db.$queryRaw<PostCard[]>`
    SELECT posts.id, posts.image, posts.created_at, posts.released_at, posts.viewed, tb2.name, tb2.description, tb2.canonical
    ${from} ${group}
    ORDER BY posts.released_at DESC
    LIMIT ${perPage} OFFSET ${(opts.page - 1) * perPage}`;
  return makePaginator(items, total, perPage, opts.page, opts.path, opts.query);
}

export type PostTab = { id: bigint; name: string | null; canonical: string | null; hasLang: boolean };

/** Chuyen muc cap 1 (publish=2, parent_id=0) lam dai tab, sap theo order. */
export const getPostTabs = cache(async (languageId: bigint): Promise<PostTab[]> => {
  const rows = await db.$queryRaw<{ id: bigint; name: string | null; canonical: string | null; lid: bigint | null }[]>`
    SELECT pc.id, l.name, l.canonical, l.post_catalogue_id AS lid
    FROM post_catalogues pc
    LEFT JOIN post_catalogue_language l ON l.post_catalogue_id = pc.id AND l.language_id = ${languageId}
    WHERE pc.publish = 2 AND pc.parent_id = 0 AND pc.deleted_at IS NULL
    ORDER BY pc.\`order\` ASC`;
  return rows.map((r) => ({ id: r.id, name: r.name, canonical: r.canonical, hasLang: r.lid !== null }));
});

export type PostDetail = {
  id: bigint;
  post_catalogue_id: number;
  image: string | null;
  album: string | null;
  viewed: number;
  name: string;
  description: string | null;
  content: string | null;
  meta_title: string | null;
  meta_keyword: string | null;
  meta_description: string | null;
  canonical: string | null;
};

/**
 * getPostById(): storefront chi mo bai publish=2 (ban goc khong loc — bai da tat van xem duoc qua URL).
 * Ban goc KHONG select posts.released_at nen view chi tiet khong bao gio in ngay dang — giu nguyen.
 */
export const getPostById = cache(async (id: bigint, languageId: bigint) => {
  const rows = await db.$queryRaw<PostDetail[]>`
    SELECT p.id, p.post_catalogue_id, p.image, p.album, p.viewed,
           tb2.name, tb2.description, tb2.content, tb2.meta_title, tb2.meta_keyword, tb2.meta_description, tb2.canonical
    FROM posts p
    JOIN post_language tb2 ON tb2.post_id = p.id
    WHERE tb2.language_id = ${languageId} AND p.id = ${id} AND p.deleted_at IS NULL AND p.publish = 2
    LIMIT 1`;
  return rows[0] ?? null;
});

/** Post::where('id', $id)->increment('viewed') — Eloquent cap nhat ca updated_at. */
export async function incrementViewed(id: bigint) {
  await db.$executeRaw`UPDATE posts SET viewed = viewed + 1, updated_at = ${now()} WHERE id = ${id} AND deleted_at IS NULL`;
}

/** 3 bai cung chuyen muc, moi nhat theo released_at. */
export async function getRelatedPosts(post: PostDetail, languageId: bigint): Promise<PostCard[]> {
  return db.$queryRaw<PostCard[]>`
    SELECT p.id, p.image, p.released_at, NULL AS created_at, p.viewed, pl.name, pl.canonical, pl.description
    FROM posts p
    JOIN post_language pl ON pl.post_id = p.id AND pl.language_id = ${languageId}
    WHERE p.publish = 2 AND p.deleted_at IS NULL
      AND p.post_catalogue_id = ${post.post_catalogue_id} AND p.id != ${post.id}
    ORDER BY p.released_at DESC
    LIMIT 3`;
}
