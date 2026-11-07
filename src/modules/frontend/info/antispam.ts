import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { ownLinkPattern } from "@/lib/constants";

/**
 * Chong spam cho form lien he (contact.html, yeu-cau-tu-van) — khong dung CAPTCHA:
 *  1. honeypot: o input an (HONEYPOT_FIELD), nguoi that khong thay nen de trong, bot dien vao
 *  2. thoi gian dien form: token ky HMAC luc render trang (FORM_TS_FIELD); gui < MIN_FILL_MS = bot
 *  3. gioi han tan suat theo IP va theo email (bo nho trong process, production chay 1 process)
 *  4. loc noi dung: the HTML / BBCode, link trong o ten-SĐT-dia chi, nhieu link, chu Kirin,
 *     loi chao hang SEO / marketing (spam thuc te trong bang contacts deu thuoc cac loai nay)
 */

export const HONEYPOT_FIELD = "contact_ref_code";
export const FORM_TS_FIELD = "_fts";

const MIN_FILL_MS = 3_000;
const MAX_TOKEN_AGE_MS = 24 * 60 * 60 * 1000;

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error("AUTH_SECRET phai dai it nhat 32 ky tu");
  return s;
}

function sign(ts: string, form: string) {
  return createHmac("sha256", secret()).update(`${form}|${ts}`).digest("base64url").slice(0, 22);
}

/** Gia tri cho input an FORM_TS_FIELD, render cung trang chua form. */
export function formToken(form: string, at = Date.now()): string {
  const ts = at.toString(36);
  return `${ts}.${sign(ts, form)}`;
}

/** missing/invalid: khong co token hoac sai chu ky (bot POST thang); fast/expired: token that. */
export function checkFormToken(token: string | null, form: string, at = Date.now()): "ok" | "missing" | "invalid" | "fast" | "expired" {
  if (!token) return "missing";
  const [ts, mac] = token.split(".");
  if (!ts || !mac) return "invalid";
  const want = Buffer.from(sign(ts, form));
  const got = Buffer.from(mac);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return "invalid";
  const age = at - parseInt(ts, 36);
  if (!Number.isFinite(age) || age < 0) return "invalid";
  if (age < MIN_FILL_MS) return "fast";
  if (age > MAX_TOKEN_AGE_MS) return "expired";
  return "ok";
}

/** IP that cua khach: Cloudflare tunnel dat cf-connecting-ip. */
export function clientIp(req: Request): string {
  const h = req.headers;
  return (
    h.get("cf-connecting-ip") ??
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    h.get("x-real-ip") ??
    "unknown"
  );
}

const LIMITS: { windowMs: number; max: number }[] = [
  { windowMs: 10 * 60 * 1000, max: 3 },
  { windowMs: 24 * 60 * 60 * 1000, max: 10 },
];
const hits = new Map<string, number[]>();

/**
 * Ghi nhan 1 lan gui cho cac khoa (vd ["ip:1.2.3.4", "email:a@b.c"]).
 * Tra false neu khoa nao da vuot gioi han (lan gui nay khong duoc tinh).
 */
export function takeRateLimit(keys: string[], at = Date.now()): boolean {
  const longest = Math.max(...LIMITS.map((l) => l.windowMs));
  if (hits.size > 5_000) {
    for (const [k, list] of hits) if (!list.some((t) => at - t < longest)) hits.delete(k);
  }
  const lists = keys.map((k) => (hits.get(k) ?? []).filter((t) => at - t < longest));
  const over = lists.some((list) => LIMITS.some((l) => list.filter((t) => at - t < l.windowMs).length >= l.max));
  keys.forEach((k, i) => hits.set(k, over ? lists[i] : [...lists[i], at]));
  return !over;
}

const URL_RE = /\bhttps?:\/\/|\bwww\.|\b[a-z0-9-]+\.(?:com|net|org|ru|shop|xyz|top|info|biz|io|co|me|ly|link|site|online)\b\/?/gi;
const OWN_LINK = ownLinkPattern(String.raw`etsy\.com`);

/** Loi chao hang SEO / marketing / thiet ke web — khach mua mu theu khong bao gio viet cac cum nay. */
const PITCH: RegExp[] = [
  /\bSEO\b|search engine optimi[sz]/i,
  /\brank(?:ing|ings)?\b[^.\n]{0,40}\bgoogle\b|\bgoogle\b[^.\n]{0,20}\brank(?:ing|ings)?\b|first page of google/i,
  /\b(?:online|brand|website(?:['’]s)?) visibility\b|\bAEO\b|\bGEO\b|answer engine|generative engine/i,
  /\bchatgpt\b[^.\n]{0,30}\b(?:gemini|perplexity|claude)\b/i,
  /\b(?:website|organic|qualified) traffic\b|\bbacklinks?\b|\bguest post|\blead generation\b|\bdomain authority\b/i,
  /\b(?:web ?design|web development|app development|digital marketing|social media marketing) (?:services?|agency|company|packages?)\b/i,
  /\b(?:quote|price list|packages and pricing|available packages)\b[^.\n]{0,40}\?|\bmay i send you\b/i,
  /\bhey team [a-z0-9-]+\.[a-z]{2,}|\bfounder & project head\b|\bunsubscribe\b|\bopt[- ]out\b/i,
  /\b(?:crypto|bitcoin|forex|casino|betting|viagra|cialis|loan offer|escort)\b/i,
];

export type SpamFields = { name?: string | null; phone?: string | null; email?: string | null; address?: string | null; message?: string | null };

/** Ly do spam (de ghi log) hoac null. Chi bat cac dau hieu ro rang de khong chan nham khach that. */
export function contentSpamReason(f: SpamFields): string | null {
  const message = f.message ?? "";
  const all = [f.name, f.phone, f.email, f.address, message].filter(Boolean).join("\n");

  if (/<\s*a\s[^>]*href|\[url[=\]]|\[link[=\]]/i.test(all)) return "html/bbcode link";
  for (const [k, v] of [["name", f.name], ["phone", f.phone], ["address", f.address]] as const) {
    if (v && ((v.match(URL_RE) ?? []).length > 0 || /<[a-z/][^>]*>/i.test(v))) return `link in ${k}`;
  }
  if (f.phone && !/\d{3}/.test(f.phone)) return "phone has no digits";
  const links = (message.match(URL_RE) ?? []).filter((u) => !OWN_LINK.test(u));
  if (links.length >= 3) return `${links.length} links`;
  if (/[Ѐ-ӿ]{3}/.test(all)) return "cyrillic";
  const pitch = PITCH.filter((re) => re.test(all)).length;
  if (pitch >= 2) return `marketing pitch (${pitch})`;
  return null;
}
