import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { now } from "@/lib/helpers";
import { listAccounts } from "./accounts";
import { META_GRAPH_VERSION } from "./config";
import { requestJson } from "./http";
import { validAccessToken } from "./oauth";

/**
 * Thong ke tuong tac cua bai da dang (social_posts.stats), gom theo san pham o trang /social/stats/index.
 *  - Facebook: GET /{page-id}/feed?fields=id,reactions.summary(total_count).limit(0),comments.summary(total_count).limit(0),shares
 *      (pages_read_engagement) https://developers.facebook.com/docs/graph-api/reference/post/
 *  - Instagram: GET /{ig-user-id}/media?fields=id,like_count,comments_count (instagram_basic)
 *      https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-media
 *  (Graph v26 da bo ?ids= nen lay qua feed / media, 100 bai moi nhat.) TikTok (can video.list) va Pinterest (analytics chi co o Standard access) chua lay.
 */

export type PostStats = { likes: number; comments: number; shares: number };

const graph = (path: string) => `https://graph.facebook.com/${META_GRAPH_VERSION()}${path}`;
const REFRESH_MS = 30 * 60_000;
const g = globalThis as unknown as { __socialStatsAt?: number };

type FbStat = { reactions?: { summary?: { total_count?: number } }; comments?: { summary?: { total_count?: number } }; shares?: { count?: number } };
type IgStat = { like_count?: number; comments_count?: number };

/** Lam moi thong ke (bo qua neu vua lam trong 30 phut, tru khi force). Tra ve so bai da cap nhat. */
export async function refreshStats(force = false): Promise<number> {
  if (!force && g.__socialStatsAt && Date.now() - g.__socialStatsAt < REFRESH_MS) return 0;
  g.__socialStatsAt = Date.now();
  let updated = 0;
  for (const acc of await listAccounts()) {
    if (acc.status !== "active" || acc.meta?.dry_run || (acc.platform !== "facebook" && acc.platform !== "instagram")) continue;
    const posts = await db.$queryRaw<{ id: bigint; remote_id: string }[]>`
      SELECT id, remote_id FROM social_posts
      WHERE account_id = ${acc.id} AND status = 'published' AND dry_run = 0 AND remote_id IS NOT NULL AND remote_id NOT LIKE 'dry%'
      ORDER BY published_at DESC LIMIT 500`;
    if (!posts.length) continue;
    const token = await validAccessToken(acc.id);
    // v26 bo tham so ?ids= -> lay qua feed cua Page / danh sach media IG (1 lan goi, toi da 100 bai moi nhat)
    const url =
      acc.platform === "facebook"
        ? `/${acc.page_id}/feed?fields=${encodeURIComponent("id,reactions.summary(total_count).limit(0),comments.summary(total_count).limit(0),shares")}&limit=100`
        : `/${acc.ig_user_id}/media?fields=id,like_count,comments_count&limit=100`;
    const res = await requestJson<{ data?: (FbStat & IgStat & { id: string })[] }>(graph(`${url}&access_token=${encodeURIComponent(token)}`), { timeoutMs: 60_000 });
    const byId = new Map((res.data ?? []).map((x) => [x.id, x]));
    const t = now();
    for (const p of posts) {
      const s = byId.get(p.remote_id);
      if (!s) continue;
      const stats: PostStats =
        acc.platform === "facebook"
          ? { likes: s.reactions?.summary?.total_count ?? 0, comments: s.comments?.summary?.total_count ?? 0, shares: s.shares?.count ?? 0 }
          : { likes: s.like_count ?? 0, comments: s.comments_count ?? 0, shares: 0 };
      await db.$executeRaw`UPDATE social_posts SET stats = ${JSON.stringify(stats)}, stats_at = ${t} WHERE id = ${p.id}`;
      updated++;
    }
  }
  return updated;
}

export type ProductStatRow = {
  product_id: bigint;
  name: string | null;
  canonical: string | null;
  image: string | null;
  posts: bigint;
  fb_likes: number | null;
  fb_comments: number | null;
  fb_shares: number | null;
  ig_likes: number | null;
  ig_comments: number | null;
  pins: bigint;
  tiktoks: bigint;
  leads: bigint;
  last_stats: Date | null;
};

/** Tong hop theo san pham, sap xep theo tong tuong tac. */
export async function productStats(sort: string) {
  const order =
    sort === "leads" ? Prisma.sql`leads DESC` : sort === "posts" ? Prisma.sql`posts DESC` : Prisma.sql`(COALESCE(fb_likes,0)+COALESCE(fb_comments,0)*2+COALESCE(fb_shares,0)*3+COALESCE(ig_likes,0)+COALESCE(ig_comments,0)*2) DESC`;
  return db.$queryRaw<ProductStatRow[]>`
    SELECT x.*, pl.name, pl.canonical, p.image,
      (SELECT COUNT(*) FROM social_messages m WHERE m.product_id = x.product_id AND m.is_lead = 1 AND m.from_page = 0) AS leads
    FROM (
      SELECT sp.source_id AS product_id, COUNT(*) AS posts,
        SUM(IF(sp.platform = 'facebook', CAST(JSON_EXTRACT(sp.stats, '$.likes') AS UNSIGNED), 0)) AS fb_likes,
        SUM(IF(sp.platform = 'facebook', CAST(JSON_EXTRACT(sp.stats, '$.comments') AS UNSIGNED), 0)) AS fb_comments,
        SUM(IF(sp.platform = 'facebook', CAST(JSON_EXTRACT(sp.stats, '$.shares') AS UNSIGNED), 0)) AS fb_shares,
        SUM(IF(sp.platform = 'instagram', CAST(JSON_EXTRACT(sp.stats, '$.likes') AS UNSIGNED), 0)) AS ig_likes,
        SUM(IF(sp.platform = 'instagram', CAST(JSON_EXTRACT(sp.stats, '$.comments') AS UNSIGNED), 0)) AS ig_comments,
        SUM(sp.platform = 'pinterest') AS pins, SUM(sp.platform = 'tiktok') AS tiktoks,
        MAX(sp.stats_at) AS last_stats
      FROM social_posts sp
      WHERE sp.source_type = 'Product' AND sp.status = 'published'
      GROUP BY sp.source_id
    ) x
    JOIN products p ON p.id = x.product_id AND p.deleted_at IS NULL
    LEFT JOIN product_language pl ON pl.product_id = x.product_id AND pl.language_id = (SELECT MIN(language_id) FROM product_language WHERE product_id = x.product_id)
    ORDER BY ${order}, x.product_id DESC`;
}
