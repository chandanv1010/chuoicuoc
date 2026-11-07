import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { now } from "@/lib/helpers";
import { decrypt, encrypt } from "./crypto";
import type { Platform } from "./types";

/** Repository bang social_accounts (dung $queryRaw de khong can prisma generate). */

export type AccountMeta = {
  dry_run?: boolean;
  /** Meta: danh sach Page cua nguoi dung (khong luu token o day) */
  pages?: { id: string; name: string; ig_id?: string | null; ig_username?: string | null }[];
  /** Pinterest: danh sach board */
  boards?: { id: string; name: string }[];
  /** TikTok: thong tin hien thi */
  avatar?: string | null;
  [k: string]: unknown;
};

export type AccountRow = {
  id: bigint;
  platform: Platform;
  name: string;
  username: string | null;
  external_id: string | null;
  page_id: string | null;
  ig_user_id: string | null;
  channel_id: string | null;
  board_id: string | null;
  access_token_enc: string | null;
  refresh_token_enc: string | null;
  token_expires_at: Date | null;
  refresh_expires_at: Date | null;
  scopes: string | null;
  status: string;
  last_error: string | null;
  meta: AccountMeta | null;
  user_id: bigint | null;
  created_at: Date | null;
  updated_at: Date | null;
};

function parseMeta(v: unknown): AccountMeta | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "string") {
    try {
      return JSON.parse(v) as AccountMeta;
    } catch {
      return null;
    }
  }
  return v as AccountMeta;
}

function hydrate(rows: AccountRow[]) {
  return rows.map((r) => ({ ...r, meta: parseMeta(r.meta) }));
}

export async function listAccounts(platform?: Platform) {
  const rows = await db.$queryRaw<AccountRow[]>`
    SELECT * FROM social_accounts ${platform ? Prisma.sql`WHERE platform = ${platform}` : Prisma.empty}
    ORDER BY FIELD(platform,'facebook','instagram','tiktok','youtube','pinterest','x'), id`;
  return hydrate(rows);
}

export async function getAccount(id: bigint | string) {
  const rows = await db.$queryRaw<AccountRow[]>`SELECT * FROM social_accounts WHERE id = ${BigInt(id)} LIMIT 1`;
  return hydrate(rows)[0] ?? null;
}

export function accessToken(a: AccountRow) {
  return decrypt(a.access_token_enc);
}

export function refreshToken(a: AccountRow) {
  return decrypt(a.refresh_token_enc);
}

export type AccountUpsert = {
  platform: Platform;
  name: string;
  username?: string | null;
  external_id?: string | null;
  page_id?: string | null;
  ig_user_id?: string | null;
  channel_id?: string | null;
  board_id?: string | null;
  access_token?: string | null;
  refresh_token?: string | null;
  token_expires_at?: Date | null;
  refresh_expires_at?: Date | null;
  scopes?: string | null;
  meta?: AccountMeta | null;
  user_id?: bigint | null;
};

/**
 * Them hoac cap nhat tai khoan theo khoa tu nhien cua nen tang
 * (fb: page_id, ig: ig_user_id, yt: channel_id, con lai: external_id).
 */
export async function upsertAccount(a: AccountUpsert) {
  const keyCol = a.platform === "facebook" ? "page_id" : a.platform === "instagram" ? "ig_user_id" : a.platform === "youtube" ? "channel_id" : "external_id";
  const keyVal = (a as Record<string, unknown>)[keyCol] as string | null | undefined;
  const t = now();
  const existing = keyVal
    ? await db.$queryRaw<{ id: bigint }[]>`SELECT id FROM social_accounts WHERE platform = ${a.platform} AND ${Prisma.raw(keyCol)} = ${keyVal} LIMIT 1`
    : [];
  const meta = a.meta ? JSON.stringify(a.meta) : null;
  if (existing[0]) {
    const id = existing[0].id;
    await db.$executeRaw`
      UPDATE social_accounts SET name = ${a.name}, username = ${a.username ?? null}, external_id = ${a.external_id ?? null},
        page_id = ${a.page_id ?? null}, ig_user_id = ${a.ig_user_id ?? null}, channel_id = ${a.channel_id ?? null},
        board_id = COALESCE(${a.board_id ?? null}, board_id),
        access_token_enc = ${encrypt(a.access_token)}, refresh_token_enc = COALESCE(${encrypt(a.refresh_token)}, refresh_token_enc),
        token_expires_at = ${a.token_expires_at ?? null}, refresh_expires_at = ${a.refresh_expires_at ?? null},
        scopes = ${a.scopes ?? null}, status = 'active', last_error = NULL, meta = ${meta}, updated_at = ${t}
      WHERE id = ${id}`;
    return id;
  }
  // LAST_INSERT_ID phai cung connection -> chay trong transaction
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`
      INSERT INTO social_accounts (platform, name, username, external_id, page_id, ig_user_id, channel_id, board_id,
        access_token_enc, refresh_token_enc, token_expires_at, refresh_expires_at, scopes, status, meta, user_id, created_at, updated_at)
      VALUES (${a.platform}, ${a.name}, ${a.username ?? null}, ${a.external_id ?? null}, ${a.page_id ?? null}, ${a.ig_user_id ?? null},
        ${a.channel_id ?? null}, ${a.board_id ?? null}, ${encrypt(a.access_token)}, ${encrypt(a.refresh_token)},
        ${a.token_expires_at ?? null}, ${a.refresh_expires_at ?? null}, ${a.scopes ?? null}, 'active', ${meta}, ${a.user_id ?? null}, ${t}, ${t})`;
    const row = await tx.$queryRaw<{ id: bigint }[]>`SELECT LAST_INSERT_ID() AS id`;
    return BigInt(row[0].id);
  });
}

/** Luu token moi sau khi refresh. */
export async function saveTokens(id: bigint, t: { access_token: string; refresh_token?: string | null; expires_at?: Date | null; refresh_expires_at?: Date | null }) {
  await db.$executeRaw`
    UPDATE social_accounts SET access_token_enc = ${encrypt(t.access_token)},
      refresh_token_enc = COALESCE(${encrypt(t.refresh_token ?? null)}, refresh_token_enc),
      token_expires_at = ${t.expires_at ?? null},
      refresh_expires_at = COALESCE(${t.refresh_expires_at ?? null}, refresh_expires_at),
      status = 'active', last_error = NULL, updated_at = ${now()}
    WHERE id = ${id}`;
}

/** Loi xac thuc -> "Can ket noi lai". */
export async function markNeedsReconnect(id: bigint, error: string) {
  await db.$executeRaw`UPDATE social_accounts SET status = 'needs_reconnect', last_error = ${error.slice(0, 2000)}, updated_at = ${now()} WHERE id = ${id}`;
}

export async function updateAccountFields(id: bigint, f: { page_id?: string | null; ig_user_id?: string | null; board_id?: string | null; name?: string; access_token?: string | null; status?: string; meta?: AccountMeta | null }) {
  const sets: Prisma.Sql[] = [Prisma.sql`updated_at = ${now()}`];
  if (f.page_id !== undefined) sets.push(Prisma.sql`page_id = ${f.page_id}`);
  if (f.ig_user_id !== undefined) sets.push(Prisma.sql`ig_user_id = ${f.ig_user_id}`);
  if (f.board_id !== undefined) sets.push(Prisma.sql`board_id = ${f.board_id}`);
  if (f.name !== undefined) sets.push(Prisma.sql`name = ${f.name}`);
  if (f.access_token !== undefined) sets.push(Prisma.sql`access_token_enc = ${encrypt(f.access_token)}`);
  if (f.status !== undefined) sets.push(Prisma.sql`status = ${f.status}`);
  if (f.meta !== undefined) sets.push(Prisma.sql`meta = ${f.meta ? JSON.stringify(f.meta) : null}`);
  await db.$executeRaw`UPDATE social_accounts SET ${Prisma.join(sets, ", ")} WHERE id = ${id}`;
}

/** Ngat ket noi: xoa tai khoan; bai dang dang cho cua tai khoan nay chuyen sang "Da huy". */
export async function deleteAccount(id: bigint) {
  await db.$transaction([
    db.$executeRaw`UPDATE social_posts SET status = 'cancelled', error = 'Tài khoản đã bị ngắt kết nối', updated_at = ${now()} WHERE account_id = ${id} AND status IN ('queued','processing')`,
    db.$executeRaw`DELETE FROM social_accounts WHERE id = ${id}`,
  ]);
}

/** Thong tin an toan gui xuong client (khong co token). */
export function publicAccount(a: AccountRow) {
  return {
    id: a.id.toString(),
    platform: a.platform,
    name: a.name,
    username: a.username,
    status: a.status,
    board_id: a.board_id,
    boards: a.meta?.boards ?? [],
    dry_run: Boolean(a.meta?.dry_run),
  };
}
export type PublicAccount = ReturnType<typeof publicAccount>;
