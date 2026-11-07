import "server-only";
import { db } from "@/lib/db";
import { now } from "@/lib/helpers";
import { decrypt, encrypt } from "@/modules/social/crypto";
import type { ListingSettings, Marketplace } from "./types";

/** Repository bang marketplace_accounts (dung $queryRaw de khong can prisma generate). */

export type ShopOption = { id: string; name: string; hint?: string };

export type AccountMeta = {
  dry_run?: boolean;
  /** du lieu cua shop lay ve tu san (de chon trong form) */
  shipping_profiles?: ShopOption[];
  return_policies?: ShopOption[];
  processing_profiles?: ShopOption[];
  /** mac dinh khi dua san pham moi len san nay */
  defaults?: Partial<ListingSettings>;
  refreshed_at?: string;
  [k: string]: unknown;
};

export type AccountRow = {
  id: bigint;
  platform: Marketplace;
  name: string;
  shop_id: string | null;
  external_id: string | null;
  shop_url: string | null;
  currency: string | null;
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

function parseJson<T>(v: unknown): T | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "string") {
    try {
      return JSON.parse(v) as T;
    } catch {
      return null;
    }
  }
  return v as T;
}

const hydrate = (rows: AccountRow[]) => rows.map((r) => ({ ...r, meta: parseJson<AccountMeta>(r.meta) }));

export async function listAccounts(platform?: Marketplace) {
  const rows = platform
    ? await db.$queryRaw<AccountRow[]>`SELECT * FROM marketplace_accounts WHERE platform = ${platform} ORDER BY id`
    : await db.$queryRaw<AccountRow[]>`SELECT * FROM marketplace_accounts ORDER BY platform, id`;
  return hydrate(rows);
}

export async function getAccount(id: bigint | string) {
  const rows = await db.$queryRaw<AccountRow[]>`SELECT * FROM marketplace_accounts WHERE id = ${BigInt(id)} LIMIT 1`;
  return hydrate(rows)[0] ?? null;
}

export type AccountUpsert = {
  platform: Marketplace;
  name: string;
  shop_id: string | null;
  external_id: string | null;
  shop_url: string | null;
  currency: string | null;
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: Date | null;
  refresh_expires_at: Date | null;
  scopes: string | null;
  meta: AccountMeta;
  user_id: bigint | null;
};

/** Cung san + cung shop -> cap nhat (ket noi lai), giu nguyen mac dinh da cau hinh. */
export async function upsertAccount(a: AccountUpsert) {
  const t = now();
  const found = a.shop_id
    ? await db.$queryRaw<{ id: bigint; meta: unknown }[]>`SELECT id, meta FROM marketplace_accounts WHERE platform = ${a.platform} AND shop_id = ${a.shop_id} LIMIT 1`
    : [];
  if (found[0]) {
    const old = parseJson<AccountMeta>(found[0].meta) ?? {};
    const meta = { ...old, ...a.meta, defaults: { ...(old.defaults ?? {}), ...(a.meta.defaults ?? {}) } };
    await db.$executeRaw`
      UPDATE marketplace_accounts SET name = ${a.name}, external_id = ${a.external_id}, shop_url = ${a.shop_url}, currency = ${a.currency},
        access_token_enc = ${encrypt(a.access_token)}, refresh_token_enc = ${encrypt(a.refresh_token)},
        token_expires_at = ${a.token_expires_at}, refresh_expires_at = ${a.refresh_expires_at}, scopes = ${a.scopes},
        status = 'active', last_error = NULL, meta = ${JSON.stringify(meta)}, updated_at = ${t}
      WHERE id = ${found[0].id}`;
    return found[0].id;
  }
  // LAST_INSERT_ID phai cung connection -> chay trong transaction
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`
      INSERT INTO marketplace_accounts (platform, name, shop_id, external_id, shop_url, currency, access_token_enc, refresh_token_enc,
        token_expires_at, refresh_expires_at, scopes, status, meta, user_id, created_at, updated_at)
      VALUES (${a.platform}, ${a.name}, ${a.shop_id}, ${a.external_id}, ${a.shop_url}, ${a.currency}, ${encrypt(a.access_token)}, ${encrypt(a.refresh_token)},
        ${a.token_expires_at}, ${a.refresh_expires_at}, ${a.scopes}, 'active', ${JSON.stringify(a.meta)}, ${a.user_id}, ${t}, ${t})`;
    const rows = await tx.$queryRaw<{ id: bigint }[]>`SELECT LAST_INSERT_ID() AS id`;
    return BigInt(rows[0].id);
  });
}

export const accessToken = (a: AccountRow) => decrypt(a.access_token_enc);
export const refreshToken = (a: AccountRow) => decrypt(a.refresh_token_enc);

export async function saveTokens(id: bigint, t: { access_token: string; refresh_token?: string | null; expires_at?: Date | null; refresh_expires_at?: Date | null }) {
  await db.$executeRaw`
    UPDATE marketplace_accounts SET access_token_enc = ${encrypt(t.access_token)},
      refresh_token_enc = COALESCE(${encrypt(t.refresh_token ?? null)}, refresh_token_enc),
      token_expires_at = ${t.expires_at ?? null}, refresh_expires_at = COALESCE(${t.refresh_expires_at ?? null}, refresh_expires_at),
      status = 'active', last_error = NULL, updated_at = ${now()}
    WHERE id = ${id}`;
}

export async function markNeedsReconnect(id: bigint, error: string) {
  await db.$executeRaw`UPDATE marketplace_accounts SET status = 'needs_reconnect', last_error = ${error.slice(0, 2000)}, updated_at = ${now()} WHERE id = ${id}`;
}

export async function updateMeta(id: bigint, meta: AccountMeta) {
  await db.$executeRaw`UPDATE marketplace_accounts SET meta = ${JSON.stringify(meta)}, updated_at = ${now()} WHERE id = ${id}`;
}

/** Ngat ket noi: xoa tai khoan, huy viec dang cho; giu ban ghi listing de biet san pham da co tren san. */
export async function deleteAccount(id: bigint) {
  await db.$executeRaw`UPDATE marketplace_listings SET status = 'idle', locked_at = NULL, next_attempt_at = NULL, updated_at = ${now()} WHERE account_id = ${id} AND status IN ('queued','processing')`;
  await db.$executeRaw`DELETE FROM marketplace_accounts WHERE id = ${id}`;
}

/** Ban rut gon an toan de dua xuong client (khong co token). */
export function publicAccount(a: AccountRow) {
  return {
    id: a.id.toString(),
    platform: a.platform,
    name: a.name,
    shop_id: a.shop_id,
    status: a.status,
    dry_run: Boolean(a.meta?.dry_run),
    shipping_profiles: a.meta?.shipping_profiles ?? [],
    return_policies: a.meta?.return_policies ?? [],
    processing_profiles: a.meta?.processing_profiles ?? [],
    defaults: a.meta?.defaults ?? {},
  };
}
export type PublicAccount = ReturnType<typeof publicAccount>;
