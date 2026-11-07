import "server-only";

/**
 * Loi khi goi API mang xa hoi.
 *  - retryable: loi tam thoi (mang, 5xx, rate limit) -> worker thu lai co backoff
 *  - auth: token het han / bi thu hoi -> danh dau tai khoan "can ket noi lai", khong thu lai
 */
export class SocialError extends Error {
  retryable: boolean;
  auth: boolean;
  constructor(message: string, opts: { retryable?: boolean; auth?: boolean } = {}) {
    super(message);
    this.retryable = opts.retryable ?? false;
    this.auth = opts.auth ?? false;
  }
}

/** Loi do du lieu dau vao (khong thu lai). */
export function invalid(message: string): never {
  throw new SocialError(message);
}

type Json = Record<string, unknown>;

/** Lay thong bao loi tu body JSON cua cac nen tang (Graph, Google, TikTok, Pinterest). */
function errorMessage(body: unknown): string {
  if (!body || typeof body !== "object") return String(body ?? "");
  const b = body as Json;
  const e = b.error as Json | string | undefined;
  if (typeof e === "string") return `${e}${b.error_description ? `: ${b.error_description}` : ""}`;
  if (e && typeof e === "object") {
    // TikTok tra error {code:"ok"} ca khi thanh cong
    const parts = [e.message, e.code && e.code !== "ok" ? `(${e.code})` : null, (e as Json).error_user_msg].filter(Boolean);
    if (parts.length) return parts.join(" ");
  }
  if (b.message) return String(b.message);
  return JSON.stringify(body).slice(0, 500);
}

/** fetch + parse JSON + phan loai loi. `isAuthError` cho phep nen tang tu nhan dien loi token. */
export async function requestJson<T = Json>(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
  isAuthError?: (status: number, body: unknown) => boolean,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: AbortSignal.timeout(init.timeoutMs ?? 120_000), cache: "no-store" });
  } catch (e) {
    throw new SocialError(`Không gọi được ${new URL(url).host}: ${(e as Error).message}`, { retryable: true });
  }
  const text = await res.text();
  let body: unknown = text;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    // giu nguyen text
  }
  const tiktokError = body && typeof body === "object" && (body as Json).error && typeof (body as Json).error === "object" && ((body as Json).error as Json).code && ((body as Json).error as Json).code !== "ok";
  if (!res.ok || tiktokError) {
    const msg = `${new URL(url).host} ${res.status}: ${errorMessage(body)}`;
    const auth = res.status === 401 || Boolean(isAuthError?.(res.status, body));
    const retryable = !auth && (res.status === 429 || res.status >= 500);
    throw new SocialError(msg, { auth, retryable });
  }
  return body as T;
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
