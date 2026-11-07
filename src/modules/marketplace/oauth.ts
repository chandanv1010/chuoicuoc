import "server-only";
import { createHash } from "node:crypto";
import { now } from "@/lib/helpers";
import { decrypt, encrypt, randomToken } from "@/modules/social/crypto";
import { SocialError } from "@/modules/social/http";
import { accessToken, getAccount, markNeedsReconnect, refreshToken, saveTokens, upsertAccount } from "./accounts";
import { credentials, redirectUri } from "./config";
import { adapterOf } from "./platforms";
import type { Marketplace } from "./types";

/**
 * OAuth chung cho cac san: /marketplace/connect/{san} -> trang dong y cua san -> /marketplace/callback/{san}.
 * State + PKCE verifier luu trong cookie ma hoa (10 phut). Adapter lo URL, doi code, lay shop.
 */

export const stateCookieName = (m: Marketplace) => `nc_mkt_${m}`;
type StateCookie = { state: string; verifier: string; ts: number };

export function encodeStateCookie(v: StateCookie) {
  return encrypt(JSON.stringify(v)) ?? "";
}

export function decodeStateCookie(raw: string | undefined): StateCookie | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(decrypt(raw) ?? "null") as StateCookie | null;
    if (!v || Date.now() - v.ts > 10 * 60_000) return null;
    return v;
  } catch {
    return null;
  }
}

export function buildAuthorizeUrl(m: Marketplace) {
  const adapter = adapterOf(m);
  if (!adapter) throw new SocialError(`Chưa hỗ trợ sàn ${m}.`);
  const state = randomToken(24);
  const verifier = randomToken(48);
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const url = adapter.authorizeUrl({ clientId: credentials(m).id, redirectUri: redirectUri(m), state, codeChallenge: challenge });
  return { url, cookie: { state, verifier, ts: Date.now() } satisfies StateCookie };
}

/** Doi code lay token, lay shop + du lieu shop, luu tai khoan. Tra ve ten shop. */
export async function handleCallback(m: Marketplace, code: string, cookie: StateCookie, userId: bigint, query: URLSearchParams = new URLSearchParams()) {
  const adapter = adapterOf(m)!;
  const t = await adapter.exchangeCode({ code, verifier: cookie.verifier, redirectUri: redirectUri(m), query });
  const shop = await adapter.fetchShop(t.access_token, t.hint);
  const data = await adapter.fetchShopData(shop.shop_id, t.access_token).catch((e: unknown) => {
    console.error("[marketplace] fetchShopData", m, e);
    return {};
  });
  await upsertAccount({ platform: m, ...shop, access_token: t.access_token, refresh_token: t.refresh_token, token_expires_at: t.expires_at, refresh_expires_at: t.refresh_expires_at, scopes: t.scopes, meta: data, user_id: userId });
  return shop.name;
}

/** Tai khoan thu (dry run) khi chua co ma app. */
export async function createDemoAccount(m: Marketplace, userId: bigint) {
  const adapter = adapterOf(m)!;
  const { shop, meta } = adapter.demoShop();
  await upsertAccount({ platform: m, ...shop, access_token: "demo", refresh_token: null, token_expires_at: null, refresh_expires_at: null, scopes: null, meta: { ...meta, dry_run: true }, user_id: userId });
  return shop.name;
}

/** Access token con han; het han (con 2 phut) -> lam moi bang refresh token. */
export async function validAccessToken(accountId: bigint): Promise<string> {
  const a = await getAccount(accountId);
  if (!a) throw new SocialError("Tài khoản sàn đã bị xóa.");
  const token = accessToken(a);
  if (!token) throw new SocialError("Mất token (đổi SOCIAL_TOKEN_KEY?), hãy kết nối lại.", { auth: true });
  if (!a.token_expires_at || a.token_expires_at.getTime() - now().getTime() > 120_000) return token;
  const rt = refreshToken(a);
  if (!rt) throw new SocialError("Token hết hạn và không có refresh token, hãy kết nối lại.", { auth: true });
  try {
    const t = await adapterOf(a.platform)!.refreshTokens(rt, a);
    await saveTokens(a.id, { access_token: t.access_token, refresh_token: t.refresh_token, expires_at: t.expires_at, refresh_expires_at: t.refresh_expires_at });
    return t.access_token;
  } catch (e) {
    if (e instanceof SocialError && e.auth) await markNeedsReconnect(a.id, e.message);
    throw e;
  }
}
