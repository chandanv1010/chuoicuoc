/**
 * Port cac ham trong app/Helpers/MyHelper.php ma ca admin lan frontend dung.
 * Ham nao chi mot module dung thi dat trong src/modules/<module>/.
 */
import { URL_SUFFIX } from "./constants";

/** image($image): null -> anh mac dinh, bo '/public/' trong duong dan. */
export function image(path: string | null | undefined): string {
  if (path === null || path === undefined) return "/backend/img/not-found.jpg";
  return path.replace("/public/", "/");
}

/** thumb(): ban Laravel hien tai tra nguyen duong dan (da tat resize). */
export function thumb(path: string | null | undefined, _w?: number, _h?: number): string {
  if (!path) return "/images/no-image.jpg";
  return path;
}

/* convert_price() (VND, dau cham ngan cach) da thay bang @/lib/money: formatMoney / parseMoney. */

/** write_url($canonical, $fullDomain = true, $suffix = true). */
export function writeUrl(canonical: string | null | undefined, fullDomain = true, suffix = true): string {
  if (!canonical) return "#";
  if (/^https?:\/\//.test(canonical)) return canonical;
  const base = fullDomain ? `${(process.env.APP_URL ?? "").replace(/\/$/, "")}/` : "";
  return `${base}${canonical}${suffix ? URL_SUFFIX : ""}`;
}

/** convertDateTime($date, 'd/m/Y H:i') */
export function convertDateTime(date: Date | string | null | undefined, format = "d/m/Y H:i"): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(`${date.replace(" ", "T")}Z`) : date;
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  const map: Record<string, string> = {
    d: pad(d.getUTCDate()),
    m: pad(d.getUTCMonth() + 1),
    Y: String(d.getUTCFullYear()),
    H: pad(d.getUTCHours()),
    i: pad(d.getUTCMinutes()),
    s: pad(d.getUTCSeconds()),
  };
  return format.replace(/[dmYHis]/g, (c) => map[c]);
}

/** Str::limit() */
export function strLimit(value: string | null | undefined, limit = 100, end = "...") {
  if (!value) return "";
  return [...value].length <= limit ? value : [...value].slice(0, limit).join("").trimEnd() + end;
}

/** strip_tags() */
export function stripTags(html: string | null | undefined) {
  return (html ?? "").replace(/<[^>]*>/g, "");
}

/**
 * Mui gio: Laravel (timezone Asia/Ho_Chi_Minh) ghi gio dia phuong vao cot
 * DATETIME/TIMESTAMP, con Prisma doc/ghi cac cot nay nhu gio UTC. Vi vay:
 *  - doc ra: dung getUTC*() se ra dung gio dia phuong Laravel da ghi;
 *  - ghi vao: dung now() duoi day thay vi new Date().
 */
const TZ_OFFSET_MS = 7 * 60 * 60 * 1000;
export function now(): Date {
  return new Date(Date.now() + TZ_OFFSET_MS);
}
