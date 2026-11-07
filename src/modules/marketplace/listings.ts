import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { now } from "@/lib/helpers";
import { DEFAULT_SETTINGS, type ListingSettings, type Marketplace } from "./types";

/** Repository bang marketplace_listings: moi cap (san pham, tai khoan san) mot dong, dung lai cho moi lan dong bo. */

export type ListingProgress = {
  /** anh da tai len san: duong dan website -> id anh tren san */
  images?: Record<string, string>;
  /** buoc da xong trong lan dong bo hien tai */
  done?: string[];
  notice?: string;
  [k: string]: unknown;
};

export type ListingRow = {
  id: bigint;
  product_id: bigint;
  account_id: bigint;
  platform: Marketplace;
  settings: ListingSettings;
  remote_id: string | null;
  remote_url: string | null;
  remote_state: string | null;
  status: string;
  stage: string | null;
  attempts: number;
  next_attempt_at: Date | null;
  locked_at: Date | null;
  error: string | null;
  progress: ListingProgress;
  dry_run: number;
  synced_at: Date | null;
  user_id: bigint | null;
  created_at: Date | null;
  updated_at: Date | null;
};

function parseJson<T>(v: unknown, fallback: T): T {
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

function hydrate(r: ListingRow): ListingRow {
  const s = parseJson<Partial<ListingSettings>>(r.settings, {});
  return {
    ...r,
    settings: { ...DEFAULT_SETTINGS, ...s, personalization: { ...DEFAULT_SETTINGS.personalization, ...(s.personalization ?? {}) } },
    progress: parseJson<ListingProgress>(r.progress, {}),
  };
}

export async function getListing(id: bigint) {
  const rows = await db.$queryRaw<ListingRow[]>`SELECT * FROM marketplace_listings WHERE id = ${id} LIMIT 1`;
  return rows[0] ? hydrate(rows[0]) : null;
}

export async function listingsOfProduct(productId: bigint) {
  const rows = await db.$queryRaw<ListingRow[]>`SELECT * FROM marketplace_listings WHERE product_id = ${productId} ORDER BY id`;
  return rows.map(hydrate);
}

export type ListingIndexRow = ListingRow & { product_name: string | null; product_image: string | null; account_name: string | null };

export async function listListings(f: { status?: string; accountId?: bigint | null; q?: string; page: number; perPage: number }) {
  const where = [Prisma.sql`1 = 1`];
  if (f.status) where.push(Prisma.sql`l.status = ${f.status}`);
  if (f.accountId) where.push(Prisma.sql`l.account_id = ${f.accountId}`);
  if (f.q) where.push(Prisma.sql`pl.name LIKE ${`%${f.q}%`}`);
  const cond = Prisma.join(where, " AND ");
  const rows = await db.$queryRaw<ListingIndexRow[]>`
    SELECT l.*, pl.name AS product_name, p.image AS product_image, a.name AS account_name
    FROM marketplace_listings l
    LEFT JOIN products p ON p.id = l.product_id
    LEFT JOIN product_language pl ON pl.product_id = l.product_id AND pl.language_id = 1
    LEFT JOIN marketplace_accounts a ON a.id = l.account_id
    WHERE ${cond}
    ORDER BY l.updated_at DESC, l.id DESC
    LIMIT ${f.perPage} OFFSET ${(f.page - 1) * f.perPage}`;
  const total = await db.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*) AS n FROM marketplace_listings l LEFT JOIN product_language pl ON pl.product_id = l.product_id AND pl.language_id = 1 WHERE ${cond}`;
  return { rows: rows.map((r) => ({ ...hydrate(r), product_name: r.product_name, product_image: r.product_image, account_name: r.account_name })), total: Number(total[0]?.n ?? 0) };
}

/**
 * Luu lua chon + dua vao hang doi (tao dong neu chua co). San pham da co tren san -> lan nay la cap nhat.
 */
export async function queueListing(productId: bigint, accountId: bigint, platform: Marketplace, settings: ListingSettings, userId: bigint | null, dryRun: boolean) {
  const t = now();
  await db.$executeRaw`
    INSERT INTO marketplace_listings (product_id, account_id, platform, settings, status, stage, attempts, next_attempt_at, error, dry_run, user_id, created_at, updated_at)
    VALUES (${productId}, ${accountId}, ${platform}, ${JSON.stringify(settings)}, 'queued', NULL, 0, ${t}, NULL, ${dryRun ? 1 : 0}, ${userId}, ${t}, ${t})
    ON DUPLICATE KEY UPDATE settings = VALUES(settings), status = IF(status = 'processing', status, 'queued'), stage = NULL, attempts = 0,
      next_attempt_at = ${t}, error = NULL, dry_run = VALUES(dry_run), user_id = VALUES(user_id), updated_at = ${t}`;
}

/** Chi luu lua chon (khong day). */
export async function saveSettings(productId: bigint, accountId: bigint, platform: Marketplace, settings: ListingSettings, userId: bigint | null) {
  const t = now();
  await db.$executeRaw`
    INSERT INTO marketplace_listings (product_id, account_id, platform, settings, status, user_id, created_at, updated_at)
    VALUES (${productId}, ${accountId}, ${platform}, ${JSON.stringify(settings)}, 'idle', ${userId}, ${t}, ${t})
    ON DUPLICATE KEY UPDATE settings = VALUES(settings), updated_at = ${t}`;
}

/* ------------------------------ Hang doi ------------------------------ */

export async function dueIds(limit = 3) {
  const rows = await db.$queryRaw<{ id: bigint }[]>`
    SELECT id FROM marketplace_listings WHERE status = 'queued' AND (next_attempt_at IS NULL OR next_attempt_at <= ${now()})
    ORDER BY next_attempt_at, id LIMIT ${limit}`;
  return rows.map((r) => r.id);
}

export async function claim(id: bigint) {
  const t = now();
  const n = await db.$executeRaw`
    UPDATE marketplace_listings SET status = 'processing', locked_at = ${t}, attempts = attempts + 1, updated_at = ${t}
    WHERE id = ${id} AND status = 'queued' AND (next_attempt_at IS NULL OR next_attempt_at <= ${t})`;
  return n === 1;
}

/** Viec treo (server tat giua chung) qua 15 phut -> tra ve hang doi, chay tiep tu buoc da luu. */
export async function releaseStale() {
  const cutoff = new Date(now().getTime() - 15 * 60_000);
  await db.$executeRaw`
    UPDATE marketplace_listings SET status = 'queued', locked_at = NULL, next_attempt_at = ${now()}, updated_at = ${now()}
    WHERE status = 'processing' AND locked_at < ${cutoff}`;
}

/** Luu tien do giua chung (id tren san, anh da tai...) de lan thu sau khong tao trung. */
export async function saveProgress(id: bigint, f: { remote_id?: string | null; remote_url?: string | null; remote_state?: string | null; stage?: string | null; progress: ListingProgress }) {
  await db.$executeRaw`
    UPDATE marketplace_listings SET remote_id = COALESCE(${f.remote_id ?? null}, remote_id), remote_url = COALESCE(${f.remote_url ?? null}, remote_url),
      remote_state = COALESCE(${f.remote_state ?? null}, remote_state), stage = ${f.stage ?? null}, progress = ${JSON.stringify(f.progress)}, updated_at = ${now()}
    WHERE id = ${id}`;
}

export async function markSynced(id: bigint, f: { remote_id: string; remote_url: string | null; remote_state: string | null; progress: ListingProgress }) {
  const t = now();
  await db.$executeRaw`
    UPDATE marketplace_listings SET status = 'synced', stage = NULL, remote_id = ${f.remote_id}, remote_url = ${f.remote_url}, remote_state = ${f.remote_state},
      progress = ${JSON.stringify(f.progress)}, error = NULL, locked_at = NULL, next_attempt_at = NULL, synced_at = ${t}, updated_at = ${t}
    WHERE id = ${id}`;
}

export async function markRetry(id: bigint, error: string, afterSec: number) {
  const t = now();
  await db.$executeRaw`
    UPDATE marketplace_listings SET status = 'queued', error = ${error.slice(0, 4000)}, locked_at = NULL,
      next_attempt_at = ${new Date(t.getTime() + afterSec * 1000)}, updated_at = ${t}
    WHERE id = ${id}`;
}

export async function markFailed(id: bigint, error: string) {
  await db.$executeRaw`
    UPDATE marketplace_listings SET status = 'failed', error = ${error.slice(0, 4000)}, locked_at = NULL, next_attempt_at = NULL, updated_at = ${now()}
    WHERE id = ${id}`;
}

/** "Thu lai" / "Dong bo lai": dua vao hang doi chay ngay. */
export async function requeue(id: bigint) {
  const t = now();
  return db.$executeRaw`
    UPDATE marketplace_listings SET status = 'queued', attempts = 0, error = NULL, locked_at = NULL, next_attempt_at = ${t}, updated_at = ${t}
    WHERE id = ${id} AND status IN ('failed', 'synced', 'idle')`;
}

/** Huy viec dang cho (chua chay). */
export async function cancelQueued(id: bigint) {
  return db.$executeRaw`UPDATE marketplace_listings SET status = IF(remote_id IS NULL, 'idle', 'synced'), next_attempt_at = NULL, updated_at = ${now()} WHERE id = ${id} AND status = 'queued'`;
}

/** Bo lien ket voi san (khong xoa san pham tren san): lan day sau se tao listing moi. */
export async function unlink(id: bigint) {
  return db.$executeRaw`
    UPDATE marketplace_listings SET remote_id = NULL, remote_url = NULL, remote_state = NULL, progress = NULL, status = 'idle', stage = NULL, error = NULL, updated_at = ${now()}
    WHERE id = ${id} AND status <> 'processing'`;
}
