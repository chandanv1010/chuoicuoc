/**
 * Port cac ham trong app/Helpers/MyHelper.php + helper Laravel (url(), Str::limit,
 * Str::words, e(), nl2br) ma giao dien website WACO dung. Giu dung hanh vi PHP
 * (ke ca cho la) de HTML ra giong ban Laravel.
 */
import { URL_SUFFIX } from "@/lib/constants";

/** config('app.url') — co dau / cuoi giong .env cua Laravel. */
export function appUrl(): string {
  return (process.env.APP_URL ?? "/").replace(/\/?$/, "/");
}

/** url('/') va url('/#x'): Laravel bo dau / cuoi cua goc. */
export function url(path = "/"): string {
  const root = appUrl().replace(/\/$/, "");
  const p = path.replace(/^\/+/, "");
  return p ? `${root}/${p}` : root;
}

/**
 * write_url($canonical, $fullDomain = true, $suffix = true) — giu nguyen ban PHP:
 * chuoi co chu "http" o bat ky dau thi tra nguyen; canonical null van ghep
 * thanh "<APP_URL>.html" (khong tra "#" nhu writeUrl() cua admin).
 */
export function writeUrl(canonical: string | null | undefined, fullDomain = true, suffix = true): string {
  const c = canonical ?? "";
  if (c.includes("http")) return c;
  return `${fullDomain ? appUrl() : ""}${c}${suffix ? URL_SUFFIX : ""}`;
}

/** e() cua Blade. */
export function e(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/** nl2br(): chen <br /> truoc moi ky tu xuong dong, giu nguyen ky tu do. */
export function nl2br(value: string): string {
  return value.replace(/(\r\n|\n\r|\r|\n)/g, "<br />$1");
}

const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  ndash: "–", mdash: "—", hellip: "…", lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”",
  laquo: "«", raquo: "»", copy: "©", reg: "®", trade: "™", deg: "°", times: "×", divide: "÷",
  middot: "·", bull: "•", plusmn: "±", frac12: "½", frac14: "¼", frac34: "¾", sup2: "²", sup3: "³",
  micro: "µ", para: "¶", sect: "§", euro: "€", cent: "¢", pound: "£", yen: "¥", iexcl: "¡", iquest: "¿",
  Agrave: "À", Aacute: "Á", Acirc: "Â", Atilde: "Ã", Auml: "Ä", Aring: "Å", AElig: "Æ", Ccedil: "Ç",
  Egrave: "È", Eacute: "É", Ecirc: "Ê", Euml: "Ë", Igrave: "Ì", Iacute: "Í", Icirc: "Î", Iuml: "Ï",
  ETH: "Ð", Ntilde: "Ñ", Ograve: "Ò", Oacute: "Ó", Ocirc: "Ô", Otilde: "Õ", Ouml: "Ö", Oslash: "Ø",
  Ugrave: "Ù", Uacute: "Ú", Ucirc: "Û", Uuml: "Ü", Yacute: "Ý", THORN: "Þ", szlig: "ß",
  agrave: "à", aacute: "á", acirc: "â", atilde: "ã", auml: "ä", aring: "å", aelig: "æ", ccedil: "ç",
  egrave: "è", eacute: "é", ecirc: "ê", euml: "ë", igrave: "ì", iacute: "í", icirc: "î", iuml: "ï",
  eth: "ð", ntilde: "ñ", ograve: "ò", oacute: "ó", ocirc: "ô", otilde: "õ", ouml: "ö", oslash: "ø",
  ugrave: "ù", uacute: "ú", ucirc: "û", uuml: "ü", yacute: "ý", thorn: "þ", yuml: "ÿ",
};

/** html_entity_decode($s, ENT_QUOTES | ENT_HTML5, 'UTF-8') (cac entity hay gap). */
export function htmlEntityDecode(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (m, code: string) => {
    if (code[0] === "#") {
      const n = code[1] === "x" || code[1] === "X" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : m;
    }
    return ENTITIES[code] ?? m;
  });
}

/** strip_tags() — go the va comment HTML. */
export function stripTags(html: string): string {
  return html.replace(/<!--[\s\S]*?-->/g, "").replace(/<\/?[a-z!][^>]*>/gi, "");
}

/** trim() cua PHP: chi bo " \t\n\r\0\x0B". */
export function phpTrim(value: string, chars = " \t\n\r\0\x0B"): string {
  let start = 0;
  let end = value.length;
  while (start < end && chars.includes(value[start])) start++;
  while (end > start && chars.includes(value[end - 1])) end--;
  return value.slice(start, end);
}

export function phpRtrim(value: string): string {
  let end = value.length;
  while (end > 0 && " \t\n\r\0\x0B".includes(value[end - 1])) end--;
  return value.slice(0, end);
}

/** plain_text($html): noi dung CKEditor -> chu thuan, giu xuong dong. */
export function plainText(html: string | null | undefined): string {
  let s = String(html ?? "");
  if (phpTrim(s) === "") return "";
  s = s.replace(/<br\s*\/?>/gi, "\n");
  s = s.replace(/<\/(?:p|div|li|tr|h[1-6])\s*>/gi, "\n");
  let text = htmlEntityDecode(stripTags(s));
  text = text.replaceAll(" ", " ");
  text = text.replace(/[^\S\r\n]+/gu, " ");
  return phpTrim(text);
}

/** text_lines($html): tach mo ta thanh danh sach dong, bo dong trong. */
export function textLines(html: string | null | undefined): string[] {
  return plainText(html)
    .split(/\r\n|\r|\n/)
    .map((d) => phpTrim(d))
    .filter((d) => d !== "");
}

/** Str::limit($value, $limit, '...') — dem theo ky tu (mb_strwidth ~ so ky tu voi chu Viet). */
export function strLimit(value: string | null | undefined, limit = 100, end = "..."): string {
  const v = String(value ?? "");
  const chars = Array.from(v);
  if (chars.length <= limit) return v;
  return phpRtrim(chars.slice(0, limit).join("")) + end;
}

/** Str::words($value, $words, $end). */
export function strWords(value: string, words = 100, end = "..."): string {
  const m = value.match(new RegExp(`^\\s*(?:\\S+\\s*){1,${words}}`, "u"));
  if (!m || m[0].length === value.length) return value;
  return phpRtrim(m[0]) + end;
}

/** youtube_id(): lay ma video YouTube tu link/iframe/ma. */
export function youtubeId(input: string | null | undefined): string {
  const s = phpTrim(String(input ?? ""));
  if (s === "") return "";
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
  const m = s.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : "";
}

/** Carbon::parse($date)->format('d/m/Y') — Prisma doc gio dia phuong Laravel nhu UTC. */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(`${date.replace(" ", "T")}Z`) : date;
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}

/** number_format($n) — ngan cach hang nghin bang dau phay. */
export function numberFormat(n: number | bigint | null | undefined): string {
  return Math.round(Number(n ?? 0))
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** mb_strtolower() */
export function mbLower(value: string): string {
  return value.toLowerCase();
}

/** cut_string_and_decode($str, $n) */
export function cutStringAndDecode(str: string | null | undefined, n = 200): string {
  const s = stripTags(htmlEntityDecode(String(str ?? "")));
  // cutnchar(): strlen tinh theo byte
  if (Buffer.byteLength(s) < n) return s;
  const cut = Buffer.from(s).subarray(0, n).toString("utf8");
  const sp = cut.lastIndexOf(" ");
  return `${sp >= 0 ? cut.slice(0, sp) : ""}...`;
}

export type Seo = {
  meta_title: string;
  meta_keyword: string;
  meta_description: string;
  meta_image: string;
  canonical: string;
};

/**
 * seo($model, $page). Ban PHP doc $model->descipriont (sai chinh ta -> null) nen
 * khi meta_description null thi luon ra chuoi rong. Toan tu ?? cua PHP: chuoi
 * rong van giu nguyen (khong lui ve name).
 */
export function seo(
  model: {
    meta_title?: string | null;
    meta_keyword?: string | null;
    meta_description?: string | null;
    name: string;
    image?: string | null;
    canonical?: string | null;
  },
  page: number = 1,
): Seo {
  const canonical =
    page > 1
      ? `${writeUrl(model.canonical, true, false)}/page-${page}${URL_SUFFIX}`
      : writeUrl(model.canonical, true, true);
  return {
    meta_title: model.meta_title ?? model.name,
    meta_keyword: model.meta_keyword ?? "",
    meta_description: model.meta_description ?? cutStringAndDecode(null, 168),
    meta_image: model.image ?? "",
    canonical,
  };
}

/** addslashes() */
export function addslashes(value: string): string {
  return value.replace(/([\\'"])/g, "\\$1").replace(/\0/g, "\\0");
}

/** json_decode($s, true) an toan: hong -> null. */
export function jsonDecode<T = unknown>(value: string | null | undefined): T | null {
  if (value === null || value === undefined || value === "") return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

/** Gia tri "truthy" theo PHP (array_filter khong callback). */
export function phpTruthy(v: unknown): boolean {
  if (v === null || v === undefined || v === false) return false;
  if (v === "" || v === "0" || v === 0) return false;
  if (Array.isArray(v) && v.length === 0) return false;
  return true;
}
