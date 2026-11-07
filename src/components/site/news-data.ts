import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { FRONTEND_LANGUAGE } from "@/modules/frontend/core";
import { plainText } from "@/modules/frontend/helpers";
import type { PostCard } from "@/modules/frontend/post";
import { getHomeProducts, readFilters, searchProducts, type StoreProduct } from "@/modules/frontend/storefront";

/**
 * Du lieu phu cho trang News (danh sach + chi tiet bai viet) ma module post chua tra ve:
 * thoi gian doc, nhan chu de (tu khoa dau tien trong meta_keyword), ngay dang cua bai,
 * va hang san pham "Shop the story". Chi doc DB.
 */

/** ~220 tu/phut, toi thieu 1 phut. */
export function readingMinutes(html: string | null | undefined): number {
  const words = plainText(html).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

/** "News, tips, gifts" -> ["News", "tips", "gifts"] */
export function keywordList(metaKeyword: string | null | undefined): string[] {
  return String(metaKeyword ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Nhan chu de cua bai: tu khoa dau tien trong meta_keyword (vd "Care guide"). */
export function topicOf(metaKeyword: string | null | undefined): string | null {
  return keywordList(metaKeyword)[0] ?? null;
}

export type PostMeta = { minutes: number; topic: string | null };

/** Thoi gian doc + chu de cho nhieu bai cung luc (the trong trang danh sach). */
export async function getPostMeta(ids: bigint[]): Promise<Map<string, PostMeta>> {
  const map = new Map<string, PostMeta>();
  if (!ids.length) return map;
  const rows = await db.$queryRaw<{ post_id: bigint; content: string | null; description: string | null; meta_keyword: string | null }[]>`
    SELECT post_id, content, description, meta_keyword FROM post_language
    WHERE language_id = ${FRONTEND_LANGUAGE} AND post_id IN (${Prisma.join(ids)})`;
  for (const r of rows) map.set(String(r.post_id), { minutes: readingMinutes(r.content || r.description), topic: topicOf(r.meta_keyword) });
  return map;
}

/** getPostById khong select ngay dang; lay rieng released_at / created_at. */
export async function getPostDate(id: bigint): Promise<Date | null> {
  const rows = await db.$queryRaw<{ released_at: Date | null; created_at: Date | null }[]>`
    SELECT released_at, created_at FROM posts WHERE id = ${id} LIMIT 1`;
  return rows[0]?.released_at ?? rows[0]?.created_at ?? null;
}

/**
 * "More stories": bai da xuat ban khac cung chuyen muc, moi nhat truoc. Khac getRelatedPosts
 * o cho tra ca created_at (bai dang qua form chua co released_at van co ngay).
 */
export async function getMoreStories(postId: bigint, catalogueId: number, limit = 3): Promise<PostCard[]> {
  return db.$queryRaw<PostCard[]>`
    SELECT p.id, p.image, p.released_at, p.created_at, p.viewed, pl.name, pl.canonical, pl.description
    FROM posts p
    JOIN post_language pl ON pl.post_id = p.id AND pl.language_id = ${FRONTEND_LANGUAGE}
    WHERE p.publish = 2 AND p.deleted_at IS NULL AND p.post_catalogue_id = ${catalogueId} AND p.id != ${postId}
    ORDER BY COALESCE(p.released_at, p.created_at) DESC, p.id DESC
    LIMIT ${limit}`;
}

/**
 * San pham lien quan den bai: thu lan luot cac tu khoa (bo tu khoa dau la chu de) cho den khi
 * co du 4 san pham; khong co thi lay hang ban chay.
 */
export async function getStoryProducts(metaKeyword: string | null | undefined, limit = 12): Promise<{ products: StoreProduct[]; keyword: string | null }> {
  for (const kw of keywordList(metaKeyword).slice(1)) {
    const { items } = await searchProducts(readFilters([["keyword", kw]], null), 1, limit);
    if (items.length >= 4) return { products: items, keyword: kw };
  }
  const { bestSellers } = await getHomeProducts();
  return { products: bestSellers.slice(0, limit), keyword: null };
}
