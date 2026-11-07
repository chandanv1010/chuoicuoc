import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { now } from "@/lib/helpers";
import { intParam, param, where, type SearchParams } from "@/server/admin-list";
import { PLATFORMS, POST_STATUS_LABEL, type Format, type MediaItem, type Platform, type SourceType } from "./types";

/** Repository bang social_posts (hang doi dang bai). */

export type PostMeta = {
  /** board Pinterest, privacy YouTube, tags, lua chon TikTok... */
  board_id?: string;
  privacy?: string;
  tags?: string[];
  hashtags?: string;
  tiktok?: Record<string, unknown>;
  /** trang thai poll cua nen tang (container id, publish id, media id...) */
  remote_state?: Record<string, unknown>;
  polls?: number;
  /** canh bao khong chan (vd TikTok SELF_ONLY) */
  notice?: string;
  forced_failed?: boolean;
  [k: string]: unknown;
};

export type SocialPostRow = {
  id: bigint;
  source_type: SourceType;
  source_id: bigint;
  account_id: bigint;
  platform: Platform;
  format: Format;
  title: string | null;
  caption: string | null;
  description: string | null;
  link: string | null;
  media: MediaItem[];
  ai_generated: number | boolean;
  meta: PostMeta;
  scheduled_at: Date | null;
  status: string;
  stage: string | null;
  attempts: number;
  next_attempt_at: Date | null;
  locked_at: Date | null;
  remote_id: string | null;
  remote_url: string | null;
  error: string | null;
  dry_run: number | boolean;
  published_at: Date | null;
  user_id: bigint | null;
  created_at: Date | null;
  updated_at: Date | null;
};

function json<T>(v: unknown, fallback: T): T {
  if (v === null || v === undefined) return fallback;
  if (typeof v === "string") {
    try {
      return JSON.parse(v) as T;
    } catch {
      return fallback;
    }
  }
  return v as T;
}

export function hydratePost(r: SocialPostRow): SocialPostRow {
  return { ...r, media: json<MediaItem[]>(r.media, []), meta: json<PostMeta>(r.meta, {}), attempts: Number(r.attempts) };
}

export async function getPost(id: bigint) {
  const rows = await db.$queryRaw<SocialPostRow[]>`SELECT * FROM social_posts WHERE id = ${id} LIMIT 1`;
  return rows[0] ? hydratePost(rows[0]) : null;
}

export type NewSocialPost = {
  source_type: SourceType;
  source_id: bigint;
  account_id: bigint;
  platform: Platform;
  format: Format;
  title: string | null;
  caption: string;
  description: string | null;
  link: string | null;
  media: MediaItem[];
  ai_generated: boolean;
  meta: PostMeta;
  scheduled_at: Date | null;
  dry_run: boolean;
  user_id: bigint | null;
};

export async function insertPosts(rows: NewSocialPost[]) {
  const t = now();
  for (const r of rows) {
    // next_attempt_at = gio hen (NULL = dang ngay)
    await db.$executeRaw`
      INSERT INTO social_posts (source_type, source_id, account_id, platform, format, title, caption, description, link, media,
        ai_generated, meta, scheduled_at, status, attempts, next_attempt_at, dry_run, user_id, created_at, updated_at)
      VALUES (${r.source_type}, ${r.source_id}, ${r.account_id}, ${r.platform}, ${r.format}, ${r.title}, ${r.caption}, ${r.description},
        ${r.link}, ${JSON.stringify(r.media)}, ${r.ai_generated ? 1 : 0}, ${JSON.stringify(r.meta)}, ${r.scheduled_at}, 'queued', 0,
        ${r.scheduled_at ?? t}, ${r.dry_run ? 1 : 0}, ${r.user_id}, ${t}, ${t})`;
  }
}

/* ------------------------------ Hang doi ------------------------------ */

/** Viec den han: queued va next_attempt_at <= bay gio (gio dia phuong luu kieu Laravel). */
export async function dueIds(limit = 5) {
  const rows = await db.$queryRaw<{ id: bigint }[]>`
    SELECT id FROM social_posts WHERE status = 'queued' AND (next_attempt_at IS NULL OR next_attempt_at <= ${now()})
    ORDER BY next_attempt_at, id LIMIT ${limit}`;
  return rows.map((r) => r.id);
}

/**
 * Nhan viec nguyen tu: chi mot worker doi duoc queued -> processing.
 * attempts chi tang khi gui that (stage NULL), khong tang khi chi la poll trang thai.
 */
export async function claim(id: bigint) {
  const t = now();
  const n = await db.$executeRaw`
    UPDATE social_posts SET status = 'processing', locked_at = ${t}, updated_at = ${t},
      attempts = attempts + IF(stage IS NULL, 1, 0)
    WHERE id = ${id} AND status = 'queued' AND (next_attempt_at IS NULL OR next_attempt_at <= ${t})`;
  return n === 1;
}

/** Viec bi treo (server tat giua chung) qua 15 phut -> tra ve hang doi. */
export async function releaseStale() {
  const cutoff = new Date(now().getTime() - 15 * 60_000);
  await db.$executeRaw`
    UPDATE social_posts SET status = 'queued', locked_at = NULL, next_attempt_at = ${now()}, updated_at = ${now()}
    WHERE status = 'processing' AND locked_at < ${cutoff}`;
}

export async function markPublished(id: bigint, remoteId: string, remoteUrl: string | null, meta: PostMeta) {
  const t = now();
  await db.$executeRaw`
    UPDATE social_posts SET status = 'published', stage = NULL, remote_id = ${remoteId}, remote_url = ${remoteUrl}, error = NULL,
      meta = ${JSON.stringify(meta)}, published_at = ${t}, locked_at = NULL, next_attempt_at = NULL, updated_at = ${t}
    WHERE id = ${id}`;
}

/** Da gui, cho nen tang xu ly: quay lai hang doi o stage poll. */
export async function markPolling(id: bigint, remoteId: string | null, meta: PostMeta, afterSec: number) {
  const t = now();
  await db.$executeRaw`
    UPDATE social_posts SET status = 'queued', stage = 'poll', remote_id = COALESCE(${remoteId}, remote_id), meta = ${JSON.stringify(meta)},
      locked_at = NULL, next_attempt_at = ${new Date(t.getTime() + afterSec * 1000)}, updated_at = ${t}
    WHERE id = ${id}`;
}

export async function markRetry(id: bigint, error: string, afterSec: number, meta?: PostMeta) {
  const t = now();
  await db.$executeRaw`
    UPDATE social_posts SET status = 'queued', stage = NULL, error = ${error.slice(0, 4000)}, locked_at = NULL,
      ${meta ? Prisma.sql`meta = ${JSON.stringify(meta)},` : Prisma.empty}
      next_attempt_at = ${new Date(t.getTime() + afterSec * 1000)}, updated_at = ${t}
    WHERE id = ${id}`;
}

export async function markFailed(id: bigint, error: string, meta?: PostMeta) {
  await db.$executeRaw`
    UPDATE social_posts SET status = 'failed', error = ${error.slice(0, 4000)}, locked_at = NULL, next_attempt_at = NULL,
      ${meta ? Prisma.sql`meta = ${JSON.stringify(meta)},` : Prisma.empty}
      updated_at = ${now()}
    WHERE id = ${id}`;
}

/** "Thu lai": bai loi/da huy -> hang doi, chay ngay, dem lai so lan thu. */
export async function retryPost(id: bigint) {
  const t = now();
  return db.$executeRaw`
    UPDATE social_posts SET status = 'queued', stage = NULL, attempts = 0, error = NULL, remote_id = NULL, remote_url = NULL,
      next_attempt_at = ${t}, locked_at = NULL, updated_at = ${t}
    WHERE id = ${id} AND status IN ('failed','cancelled')`;
}

/** "Chay ngay": bai dang cho (ke ca hen gio) -> den han ngay. */
export async function runNow(id: bigint) {
  const t = now();
  return db.$executeRaw`UPDATE social_posts SET next_attempt_at = ${t}, updated_at = ${t} WHERE id = ${id} AND status = 'queued'`;
}

export async function cancelPost(id: bigint) {
  return db.$executeRaw`
    UPDATE social_posts SET status = 'cancelled', updated_at = ${now()} WHERE id = ${id} AND status = 'queued' AND stage IS NULL`;
}

/* ------------------------------ Danh sach ------------------------------ */

export type HistoryRow = SocialPostRow & { account_name: string | null; source_name: string | null; source_canonical: string | null };

const SOURCE_NAME = Prisma.sql`
  CASE sp.source_type
    WHEN 'Product' THEN (SELECT pl.name FROM product_language pl WHERE pl.product_id = sp.source_id ORDER BY pl.language_id LIMIT 1)
    WHEN 'Post' THEN (SELECT pl.name FROM post_language pl WHERE pl.post_id = sp.source_id ORDER BY pl.language_id LIMIT 1)
  END`;

export async function paginateHistory(sp: SearchParams) {
  const perPage = 20;
  const page = Math.max(1, intParam(sp, "page") || 1);
  const platform = param(sp, "platform");
  const status = param(sp, "status");
  const source = param(sp, "source");
  const sourceId = param(sp, "source_id");
  const cond = where([
    platform && (PLATFORMS as readonly string[]).includes(platform) ? Prisma.sql`sp.platform = ${platform}` : null,
    status && status in POST_STATUS_LABEL ? Prisma.sql`sp.status = ${status}` : null,
    source === "Product" || source === "Post" ? Prisma.sql`sp.source_type = ${source}` : null,
    sourceId && /^\d+$/.test(sourceId) ? Prisma.sql`sp.source_id = ${sourceId}` : null,
  ]);
  const [rows, count] = await Promise.all([
    db.$queryRaw<HistoryRow[]>`
      SELECT sp.*, sa.name AS account_name, ${SOURCE_NAME} AS source_name
      FROM social_posts sp LEFT JOIN social_accounts sa ON sa.id = sp.account_id
      ${cond}
      ORDER BY sp.id DESC LIMIT ${perPage} OFFSET ${(page - 1) * perPage}`,
    db.$queryRaw<{ c: bigint }[]>`SELECT COUNT(*) AS c FROM social_posts sp ${cond}`,
  ]);
  return { rows: rows.map((r) => hydratePost(r) as HistoryRow), total: Number(count[0].c), perPage, page };
}

/** Lich su dang cua mot san pham / bai viet (trang sua). */
export async function historyOf(sourceType: SourceType, sourceId: bigint, limit = 30) {
  const rows = await db.$queryRaw<HistoryRow[]>`
    SELECT sp.*, sa.name AS account_name, NULL AS source_name
    FROM social_posts sp LEFT JOIN social_accounts sa ON sa.id = sp.account_id
    WHERE sp.source_type = ${sourceType} AND sp.source_id = ${sourceId}
    ORDER BY sp.id DESC LIMIT ${limit}`;
  return rows.map((r) => hydratePost(r) as HistoryRow);
}

export async function countByStatus() {
  const rows = await db.$queryRaw<{ status: string; c: bigint }[]>`SELECT status, COUNT(*) AS c FROM social_posts GROUP BY status`;
  return Object.fromEntries(rows.map((r) => [r.status, Number(r.c)])) as Record<string, number>;
}
