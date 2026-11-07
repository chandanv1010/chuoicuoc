/**
 * Helper dung chung cho module promotion + voucher, mo phong hanh vi PHP/Laravel:
 *  - middleware TrimStrings + ConvertEmptyStringsToNull ($request->input()),
 *  - json_encode() mac dinh (escape "/" va unicode),
 *  - DateTime::createFromFormat('d/m/Y H:i') cua rule custom_date_format/custom_after
 *    (AppServiceProvider),
 *  - so sanh long leo (==) cua PHP 8.
 */
import type { Input } from "@/lib/http";

/** TrimStrings + ConvertEmptyStringsToNull (de quy nhu Laravel). */
export function laravelInput<T = unknown>(value: T): T {
  if (typeof value === "string") {
    const t = value.trim();
    return (t === "" ? null : t) as T;
  }
  if (Array.isArray(value)) return value.map((v) => laravelInput(v)) as T;
  if (value && typeof value === "object" && !(value instanceof File)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = k === "password" || k === "password_confirmation" ? v : laravelInput(v);
    }
    return out as T;
  }
  return value;
}

/** data_get($input, 'a.b') */
export function dataGet(input: unknown, path: string): unknown {
  let node: unknown = input;
  for (const p of path.split(".")) {
    if (node && typeof node === "object") node = (node as Record<string, unknown>)[p];
    else return undefined;
  }
  return node;
}

/** $request->only(...): bo qua key khong co trong input. */
export function only(input: Input, keys: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of keys) if (k in input) out[k] = input[k];
  return out;
}

/** json_encode() mac dinh cua PHP: escape "/" va ky tu ngoai ASCII thanh \uXXXX. */
export function phpJson(value: unknown): string {
  const json = JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? Number(v) : v)) ?? "null";
  return json.replace(/\//g, "\\/").replace(/[\u0080-￿]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`);
}

/* convert_price() kieu VND da bo: tien USD doc bang parseMoney()/toCents() cua @/lib/money. */

const NUMERIC = /^\s*[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?\s*$/;
export const isNumeric = (v: unknown) => typeof v === "number" || (typeof v === "string" && NUMERIC.test(v));

/** $a == 0 cua PHP 8 */
export function looseEqZero(v: unknown): boolean {
  if (v === null || v === undefined || v === false) return true;
  if (typeof v === "number") return v === 0;
  if (typeof v === "string") return isNumeric(v) ? Number(v) === 0 : false;
  return false;
}

/** in_array($needle, $list) long leo, chi cho 2 truong hop rule dung: 0 va '' */
export function inArrayLoose(needle: 0 | "", list: unknown[]): boolean {
  return list.some((v) => (needle === 0 ? looseEqZero(v) : v === null || v === undefined || v === "" || v === false));
}

/** So sanh $a <=> $b kieu PHP 8 (chuoi so -> so, con lai so sanh chuoi). */
export function phpCompare(a: unknown, b: unknown): number {
  if (isNumeric(a) && isNumeric(b)) return Number(a) - Number(b);
  const sa = a === null || a === undefined ? "" : String(a);
  const sb = b === null || b === undefined ? "" : String(b);
  return sa < sb ? -1 : sa > sb ? 1 : 0;
}

/**
 * DateTime::createFromFormat('d/m/Y H:i', $value): tra ve Date (gio dia phuong
 * luu trong truong UTC, giong quy uoc now() cua @/lib/helpers) hoac null.
 * PHP chap nhan ngay/gio tran (32/13/2024 -> tu cong don) nen o day cung vay.
 */
export function parseDmyHi(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const m = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{1,4})[ \t](\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const [, d, mo, y, h, i] = m.map(Number);
  const date = new Date(Date.UTC(2000, 0, 1, 0, 0, 0));
  date.setUTCFullYear(y, mo - 1, d);
  date.setUTCHours(h, i, 0, 0);
  return date;
}

/** Date (quy uoc gio dia phuong trong truong UTC) -> 'Y-m-d H:i:s' de ghi DB. */
export function sqlDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${String(d.getUTCFullYear()).padStart(4, "0")}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
}

/**
 * Carbon khi ->toJson(): chuyen gio dia phuong (Asia/Ho_Chi_Minh) sang UTC dang
 * 2026-09-16T10:57:16.000000Z.
 */
export function carbonJson(d: Date | null | undefined): string | null {
  if (!d) return null;
  const utc = new Date(d.getTime() - 7 * 3600 * 1000);
  return utc.toISOString().replace(/\.\d{3}Z$/, ".000000Z");
}

/** Chuyen BigInt -> number, Date -> chuoi Carbon, de tra JSON giong Eloquent. */
export function eloquentJson<T>(row: T): unknown {
  if (row === null || row === undefined) return row;
  if (typeof row === "bigint") return Number(row);
  if (row instanceof Date) return carbonJson(row);
  if (Array.isArray(row)) return row.map((r) => eloquentJson(r));
  if (typeof row === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row as Record<string, unknown>)) {
      // Prisma Decimal / so thuc
      out[k] = v && typeof v === "object" && "toNumber" in (v as object) ? (v as { toNumber(): number }).toNumber() : eloquentJson(v);
    }
    return out;
  }
  return row;
}
