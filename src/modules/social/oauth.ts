import "server-only";
import { createHash } from "node:crypto";
import { now } from "@/lib/helpers";
import { accessToken, getAccount, listAccounts, markNeedsReconnect, refreshToken, saveTokens, updateAccountFields, upsertAccount, type AccountRow } from "./accounts";
import { credentials, env, META_GRAPH_VERSION, oauthKeyOf, pinterestApiBase, redirectUri } from "./config";
import { decrypt, encrypt, randomToken } from "./crypto";
import { requestJson, SocialError } from "./http";
import type { OAuthKey } from "./types";

/**
 * OAuth cho tung nen tang. Route: /social/connect/{key} -> trang dong y cua nen tang
 * -> /social/callback/{key}. State + PKCE verifier luu trong cookie ma hoa (10 phut).
 *
 * Tai lieu:
 *  - Meta: https://developers.facebook.com/docs/facebook-login/guides/advanced/manual-flow
 *          https://developers.facebook.com/docs/facebook-login/guides/access-tokens/get-long-lived
 *          https://developers.facebook.com/docs/pages-api/getting-started
 *  - TikTok: https://developers.tiktok.com/doc/login-kit-web
 *            https://developers.tiktok.com/doc/oauth-user-access-token-management
 *            (PKCE: TikTok dung SHA256 dang hex cho code_challenge — https://developers.tiktok.com/doc/login-kit-desktop)
 *  - Google: https://developers.google.com/identity/protocols/oauth2/web-server
 *  - Pinterest: https://developers.pinterest.com/docs/getting-started/set-up-authentication-and-authorization/
 *  - X: https://docs.x.com/fundamentals/authentication/oauth-2-0/authorization-code
 *       (PKCE S256; app loai Web App = confidential client -> Basic auth o token endpoint;
 *        access token 2 gio, offline.access de co refresh token, refresh token doi moi moi lan dung)
 */

/** Scope xin cho moi key (khop docs/SOCIAL-API-SETUP.md). */
export const SCOPES: Record<OAuthKey, string[]> = {
  // pages_read_user_content: doc binh luan tren bai cua Page (hop thu inbox.ts).
  // Tin nhan Messenger / Instagram Direct + binh luan IG can them pages_messaging, instagram_manage_comments,
  // instagram_manage_messages — chi xin duoc khi app Meta da bat use case Messenger / Instagram messaging,
  // neu khong Facebook bao "Invalid Scopes". Bat bang META_EXTRA_SCOPES="pages_messaging,instagram_manage_comments,instagram_manage_messages".
  facebook: [
    "pages_show_list",
    "pages_read_engagement",
    "pages_manage_posts",
    "pages_read_user_content",
    // tra loi / an binh luan tu admin (actions.ts)
    "pages_manage_engagement",
    "instagram_basic",
    "instagram_content_publish",
    "business_management",
    ...env("META_EXTRA_SCOPES").split(",").map((x) => x.trim()).filter(Boolean),
  ],
  tiktok: ["user.info.basic", "video.publish"],
  youtube: ["https://www.googleapis.com/auth/youtube.upload", "https://www.googleapis.com/auth/youtube.readonly"],
  pinterest: ["boards:read", "boards:write", "pins:read", "pins:write", "user_accounts:read"],
  x: ["tweet.read", "tweet.write", "users.read", "media.write", "offline.access"],
};

const xBasicAuth = (id: string, secret: string) => `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`;

export const stateCookieName = (key: OAuthKey) => `nc_social_${key}`;

type StateCookie = { state: string; verifier?: string; ts: number; back?: string };

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

const graph = (path: string) => `https://graph.facebook.com/${META_GRAPH_VERSION()}${path}`;

/** Tao URL dang nhap/dong y cua nen tang + gia tri luu cookie. */
export function buildAuthorizeUrl(key: OAuthKey, clientIdOverride?: string) {
  const { id } = credentials(key);
  const clientId = id || clientIdOverride || "";
  const state = randomToken(24);
  const redirect = redirectUri(key);
  let url: URL;
  let verifier: string | undefined;
  switch (key) {
    case "facebook":
      url = new URL(`https://www.facebook.com/${META_GRAPH_VERSION()}/dialog/oauth`);
      url.searchParams.set("client_id", clientId);
      url.searchParams.set("redirect_uri", redirect);
      url.searchParams.set("state", state);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("scope", SCOPES.facebook.join(","));
      break;
    case "tiktok": {
      // PKCE: verifier 43-128 ky tu; challenge = hex(SHA256(verifier)) theo tai lieu TikTok
      verifier = randomToken(48);
      url = new URL("https://www.tiktok.com/v2/auth/authorize/");
      url.searchParams.set("client_key", clientId);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("scope", SCOPES.tiktok.join(","));
      url.searchParams.set("redirect_uri", redirect);
      url.searchParams.set("state", state);
      url.searchParams.set("code_challenge", createHash("sha256").update(verifier).digest("hex"));
      url.searchParams.set("code_challenge_method", "S256");
      break;
    }
    case "youtube":
      // PKCE chuan (base64url) + offline de co refresh token; prompt=consent de Google luon tra refresh token
      verifier = randomToken(48);
      url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      url.searchParams.set("client_id", clientId);
      url.searchParams.set("redirect_uri", redirect);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("scope", SCOPES.youtube.join(" "));
      url.searchParams.set("access_type", "offline");
      url.searchParams.set("prompt", "consent");
      url.searchParams.set("include_granted_scopes", "true");
      url.searchParams.set("state", state);
      url.searchParams.set("code_challenge", createHash("sha256").update(verifier).digest("base64url"));
      url.searchParams.set("code_challenge_method", "S256");
      break;
    case "pinterest":
      url = new URL("https://www.pinterest.com/oauth/");
      url.searchParams.set("client_id", clientId);
      url.searchParams.set("redirect_uri", redirect);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("scope", SCOPES.pinterest.join(","));
      url.searchParams.set("state", state);
      break;
    case "x":
      verifier = randomToken(48);
      url = new URL("https://x.com/i/oauth2/authorize");
      url.searchParams.set("response_type", "code");
      url.searchParams.set("client_id", clientId);
      url.searchParams.set("redirect_uri", redirect);
      url.searchParams.set("scope", SCOPES.x.join(" "));
      url.searchParams.set("state", state);
      url.searchParams.set("code_challenge", createHash("sha256").update(verifier).digest("base64url"));
      url.searchParams.set("code_challenge_method", "S256");
      break;
  }
  return { url: url.toString(), cookie: { state, verifier, ts: Date.now() } satisfies StateCookie };
}

const secondsFromNow = (s: unknown) => (typeof s === "number" && s > 0 ? new Date(now().getTime() + s * 1000) : null);

/* ------------------------------ Callback ------------------------------ */

type TokenJson = Record<string, unknown> & { access_token?: string; refresh_token?: string; expires_in?: number };

/** Doi code lay token, luu tai khoan. Tra ve so tai khoan da luu + ten. */
export async function handleCallback(key: OAuthKey, code: string, cookie: StateCookie, userId: bigint): Promise<string[]> {
  const { id, secret } = credentials(key);
  const redirect = redirectUri(key);
  switch (key) {
    case "facebook": {
      const q = new URLSearchParams({ client_id: id, client_secret: secret, redirect_uri: redirect, code });
      const short = await requestJson<TokenJson>(graph(`/oauth/access_token?${q}`));
      const long = await requestJson<TokenJson>(
        graph(`/oauth/access_token?${new URLSearchParams({ grant_type: "fb_exchange_token", client_id: id, client_secret: secret, fb_exchange_token: String(short.access_token) })}`),
      );
      const userToken = String(long.access_token);
      return saveMetaAccounts(userToken, secondsFromNow(long.expires_in), userId);
    }
    case "tiktok": {
      const body = new URLSearchParams({ client_key: id, client_secret: secret, code, grant_type: "authorization_code", redirect_uri: redirect });
      if (cookie.verifier) body.set("code_verifier", cookie.verifier);
      const tok = await requestJson<TokenJson & { open_id?: string; scope?: string; refresh_expires_in?: number }>("https://open.tiktokapis.com/v2/oauth/token/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
      const info = await requestJson<{ data?: { user?: { open_id?: string; display_name?: string; avatar_url?: string } } }>(
        "https://open.tiktokapis.com/v2/user/info/?fields=open_id,avatar_url,display_name",
        { headers: { Authorization: `Bearer ${tok.access_token}` } },
      );
      const user = info.data?.user ?? {};
      await upsertAccount({
        platform: "tiktok",
        name: user.display_name || "TikTok",
        external_id: String(tok.open_id ?? user.open_id ?? ""),
        access_token: String(tok.access_token),
        refresh_token: tok.refresh_token ?? null,
        token_expires_at: secondsFromNow(tok.expires_in),
        refresh_expires_at: secondsFromNow(tok.refresh_expires_in),
        scopes: tok.scope ?? SCOPES.tiktok.join(","),
        meta: { avatar: user.avatar_url ?? null },
        user_id: userId,
      });
      return [user.display_name || "TikTok"];
    }
    case "youtube": {
      const body = new URLSearchParams({ client_id: id, client_secret: secret, code, grant_type: "authorization_code", redirect_uri: redirect });
      if (cookie.verifier) body.set("code_verifier", cookie.verifier);
      const tok = await requestJson<TokenJson & { scope?: string }>("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
      const ch = await requestJson<{ items?: { id: string; snippet?: { title?: string; customUrl?: string } }[] }>(
        "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true",
        { headers: { Authorization: `Bearer ${tok.access_token}` } },
      );
      const channel = ch.items?.[0];
      if (!channel) throw new SocialError("Tài khoản Google này chưa có kênh YouTube.");
      await upsertAccount({
        platform: "youtube",
        name: channel.snippet?.title || "YouTube",
        username: channel.snippet?.customUrl ?? null,
        channel_id: channel.id,
        access_token: String(tok.access_token),
        refresh_token: tok.refresh_token ?? null,
        token_expires_at: secondsFromNow(tok.expires_in),
        scopes: tok.scope ?? SCOPES.youtube.join(" "),
        user_id: userId,
      });
      return [channel.snippet?.title || "YouTube"];
    }
    case "pinterest": {
      const tok = await requestJson<TokenJson & { scope?: string; refresh_token_expires_in?: number }>(`${pinterestApiBase()}/oauth/token`, {
        method: "POST",
        headers: { Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirect }),
      });
      const auth = { Authorization: `Bearer ${tok.access_token}` };
      const user = await requestJson<{ id?: string; username?: string; business_name?: string }>(`${pinterestApiBase()}/user_account`, { headers: auth });
      const boards = await requestJson<{ items?: { id: string; name: string }[] }>(`${pinterestApiBase()}/boards?page_size=100`, { headers: auth });
      const list = (boards.items ?? []).map((b) => ({ id: String(b.id), name: b.name }));
      await upsertAccount({
        platform: "pinterest",
        name: user.business_name || user.username || "Pinterest",
        username: user.username ?? null,
        external_id: String(user.id ?? user.username ?? ""),
        board_id: list[0]?.id ?? null,
        access_token: String(tok.access_token),
        refresh_token: tok.refresh_token ?? null,
        token_expires_at: secondsFromNow(tok.expires_in),
        refresh_expires_at: secondsFromNow(tok.refresh_token_expires_in),
        scopes: tok.scope ?? SCOPES.pinterest.join(","),
        meta: { boards: list },
        user_id: userId,
      });
      return [user.username || "Pinterest"];
    }
    case "x": {
      // Ma code chi song 30 giay -> doi ngay
      const body = new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirect, client_id: id });
      if (cookie.verifier) body.set("code_verifier", cookie.verifier);
      const tok = await requestJson<TokenJson & { scope?: string }>("https://api.x.com/2/oauth2/token", {
        method: "POST",
        headers: { Authorization: xBasicAuth(id, secret), "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
      const me = await requestJson<{ data?: { id: string; name?: string; username?: string } }>("https://api.x.com/2/users/me", {
        headers: { Authorization: `Bearer ${tok.access_token}` },
      });
      const user = me.data;
      if (!user) throw new SocialError("X không trả về thông tin tài khoản.");
      await upsertAccount({
        platform: "x",
        name: user.username ? `@${user.username}` : user.name || "X",
        username: user.username ?? null,
        external_id: user.id,
        access_token: String(tok.access_token),
        refresh_token: tok.refresh_token ?? null,
        token_expires_at: secondsFromNow(tok.expires_in),
        scopes: tok.scope ?? SCOPES.x.join(" "),
        meta: { display_name: user.name ?? null },
        user_id: userId,
      });
      return [user.username ? `@${user.username}` : "X"];
    }
  }
}

type MetaPage = { id: string; name: string; access_token: string; instagram_business_account?: { id: string; username?: string } };

export async function fetchMetaPages(userToken: string) {
  const res = await requestJson<{ data?: MetaPage[] }>(
    graph(`/me/accounts?${new URLSearchParams({ fields: "id,name,access_token,instagram_business_account{id,username}", limit: "100", access_token: userToken })}`),
    {},
    metaAuthError,
  );
  return res.data ?? [];
}

/**
 * Meta: mot tai khoan Facebook (Page dang chon, mac dinh Page dau tien) + Instagram lien ket cua Page do.
 * Page token lay tu long-lived user token khong het han; user token luu o refresh_token_enc de doi Page.
 */
async function saveMetaAccounts(userToken: string, userTokenExpires: Date | null, userId: bigint, pageId?: string) {
  const me = await requestJson<{ id: string; name: string }>(graph(`/me?fields=id,name&access_token=${encodeURIComponent(userToken)}`));
  const pages = await fetchMetaPages(userToken);
  if (!pages.length) throw new SocialError("Tài khoản Facebook này không quản lý Page nào (hoặc chưa cấp quyền Page khi đăng nhập).");
  // Ket noi lai: giu Page da chon truoc do cua cung nguoi dung
  const previous = (await listAccounts("facebook")).find((a) => a.external_id === me.id && pages.some((p) => p.id === a.page_id));
  const page = pages.find((p) => p.id === (pageId ?? previous?.page_id)) ?? pages[0];
  const pageList = pages.map((p) => ({ id: p.id, name: p.name, ig_id: p.instagram_business_account?.id ?? null, ig_username: p.instagram_business_account?.username ?? null }));
  const saved = [page.name];
  await upsertAccount({
    platform: "facebook",
    name: page.name,
    username: me.name,
    external_id: me.id,
    page_id: page.id,
    access_token: page.access_token,
    refresh_token: userToken,
    refresh_expires_at: userTokenExpires,
    scopes: SCOPES.facebook.join(","),
    meta: { pages: pageList },
    user_id: userId,
  });
  const ig = page.instagram_business_account;
  if (ig) {
    await upsertAccount({
      platform: "instagram",
      name: ig.username ? `@${ig.username}` : `Instagram ${ig.id}`,
      username: ig.username ?? null,
      external_id: me.id,
      page_id: page.id,
      ig_user_id: ig.id,
      access_token: page.access_token,
      refresh_token: userToken,
      refresh_expires_at: userTokenExpires,
      scopes: SCOPES.facebook.join(","),
      meta: { pages: pageList },
      user_id: userId,
    });
    saved.push(ig.username ? `@${ig.username}` : "Instagram");
  }
  return saved;
}

/** Doi Page cho tai khoan Facebook (dung user token da luu). */
export async function switchMetaPage(account: AccountRow, pageId: string, userId: bigint) {
  const userToken = refreshToken(account);
  if (!userToken) throw new SocialError("Không còn token người dùng Facebook, hãy kết nối lại.", { auth: true });
  const pages = await fetchMetaPages(userToken);
  const page = pages.find((p) => p.id === pageId);
  if (!page) throw new SocialError("Không tìm thấy Page này trong danh sách Page bạn quản lý.");
  // Cap nhat tai cho (giu id tai khoan de lich su dang van gan dung)
  await updateAccountFields(account.id, { page_id: page.id, name: page.name, access_token: page.access_token });
  const ig = page.instagram_business_account;
  if (ig) {
    await upsertAccount({
      platform: "instagram",
      name: ig.username ? `@${ig.username}` : `Instagram ${ig.id}`,
      username: ig.username ?? null,
      external_id: account.external_id,
      page_id: page.id,
      ig_user_id: ig.id,
      access_token: page.access_token,
      refresh_token: userToken,
      refresh_expires_at: account.refresh_expires_at,
      scopes: account.scopes,
      meta: account.meta,
      user_id: userId,
    });
  }
  return [page.name, ...(ig ? [ig.username ? `@${ig.username}` : "Instagram"] : [])];
}

/** Graph API: code 190 (token het han/bi thu hoi), 102 (session) -> can ket noi lai. */
export function metaAuthError(_status: number, body: unknown) {
  const e = (body as { error?: { code?: number; type?: string } })?.error;
  return e?.code === 190 || e?.code === 102;
}

/* ------------------------------ Refresh ------------------------------ */

const EARLY_MS = 5 * 60_000;

/**
 * Token dung duoc cho tai khoan: tu refresh neu sap het han.
 * Loi xac thuc -> danh dau "Can ket noi lai" va nem SocialError(auth).
 */
export async function validAccessToken(accountId: bigint): Promise<string> {
  const account = await getAccount(accountId);
  if (!account) throw new SocialError("Tài khoản mạng xã hội đã bị xóa.");
  if (account.status === "needs_reconnect") throw new SocialError(`Tài khoản ${account.name} cần kết nối lại.`, { auth: true });
  const token = accessToken(account);
  if (!token) {
    await markNeedsReconnect(account.id, "Không giải mã được token (đổi SOCIAL_TOKEN_KEY?)");
    throw new SocialError("Không đọc được token (có thể đã đổi SOCIAL_TOKEN_KEY). Hãy kết nối lại.", { auth: true });
  }
  const expires = account.token_expires_at?.getTime();
  if (!expires || expires - EARLY_MS > now().getTime()) return token;
  try {
    return await refresh(account);
  } catch (e) {
    const err = e instanceof SocialError ? e : new SocialError(String(e));
    if (!err.retryable) {
      const hint = account.platform === "youtube" ? " (Ứng dụng Google ở trạng thái Testing: refresh token hết hạn sau 7 ngày)" : "";
      await markNeedsReconnect(account.id, `Làm mới token thất bại: ${err.message}${hint}`);
      throw new SocialError(`Tài khoản ${account.name} cần kết nối lại: ${err.message}${hint}`, { auth: true });
    }
    throw err;
  }
}

async function refresh(account: AccountRow): Promise<string> {
  const key = oauthKeyOf(account.platform);
  const { id, secret } = credentials(key);
  const rt = refreshToken(account);
  if (!rt) throw new SocialError("Không có refresh token");
  switch (key) {
    case "tiktok": {
      const tok = await requestJson<TokenJson & { refresh_expires_in?: number }>("https://open.tiktokapis.com/v2/oauth/token/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ client_key: id, client_secret: secret, grant_type: "refresh_token", refresh_token: rt }),
      });
      // TikTok co the tra refresh token moi -> luu lai
      await saveTokens(account.id, { access_token: String(tok.access_token), refresh_token: tok.refresh_token, expires_at: secondsFromNow(tok.expires_in), refresh_expires_at: secondsFromNow(tok.refresh_expires_in) });
      return String(tok.access_token);
    }
    case "youtube": {
      const tok = await requestJson<TokenJson>(
        "https://oauth2.googleapis.com/token",
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ client_id: id, client_secret: secret, grant_type: "refresh_token", refresh_token: rt }),
        },
        (status, body) => status === 400 && (body as { error?: string })?.error === "invalid_grant",
      );
      await saveTokens(account.id, { access_token: String(tok.access_token), refresh_token: tok.refresh_token, expires_at: secondsFromNow(tok.expires_in) });
      return String(tok.access_token);
    }
    case "pinterest": {
      const tok = await requestJson<TokenJson & { refresh_token_expires_in?: number }>(`${pinterestApiBase()}/oauth/token`, {
        method: "POST",
        headers: { Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: rt }),
      });
      await saveTokens(account.id, { access_token: String(tok.access_token), refresh_token: tok.refresh_token, expires_at: secondsFromNow(tok.expires_in), refresh_expires_at: secondsFromNow(tok.refresh_token_expires_in) });
      return String(tok.access_token);
    }
    case "x": {
      // X doi refresh token moi lan dung -> luu ngay ca hai
      const tok = await requestJson<TokenJson>(
        "https://api.x.com/2/oauth2/token",
        {
          method: "POST",
          headers: { Authorization: xBasicAuth(id, secret), "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: rt, client_id: id }),
        },
        (status) => status === 400 || status === 401,
      );
      await saveTokens(account.id, { access_token: String(tok.access_token), refresh_token: tok.refresh_token, expires_at: secondsFromNow(tok.expires_in) });
      return String(tok.access_token);
    }
    case "facebook":
      // Page token tu long-lived user token khong het han; neu co han thi phai dang nhap lai
      throw new SocialError("Token Facebook đã hết hạn");
  }
}
