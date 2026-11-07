/**
 * Helper PHP nho cho gio hang/tai khoan (port hanh vi cua PHP + goi
 * mindscms/laravelshoppingcart). Cac helper Laravel dung chung lay tu
 * @/modules/promotion/php (laravelInput, phpJson...).
 */
import { createHash } from "node:crypto";

export function md5(s: string): string {
  return createHash("md5").update(s, "utf8").digest("hex");
}

/** serialize() cua PHP (du cho mang options cua CartItem). */
export function phpSerialize(v: unknown): string {
  if (v === null || v === undefined) return "N;";
  if (typeof v === "boolean") return `b:${v ? 1 : 0};`;
  if (typeof v === "bigint") return `i:${v};`;
  if (typeof v === "number") return Number.isInteger(v) ? `i:${v};` : `d:${v};`;
  if (typeof v === "string") return `s:${Buffer.byteLength(v)}:"${v}";`;
  if (v instanceof Date) return phpSerialize(v.toISOString());
  const entries: [string | number, unknown][] = Array.isArray(v)
    ? v.map((x, i) => [i, x])
    : Object.entries(v as Record<string, unknown>);
  const body = entries
    .map(([k, x]) => (typeof k === "number" || /^(0|-?[1-9]\d*)$/.test(k) ? `i:${k};` : phpSerialize(k)) + phpSerialize(x))
    .join("");
  return `a:${entries.length}:{${body}}`;
}

/** ksort() mot cap. */
export function ksort<T extends Record<string, unknown>>(o: T): T {
  return Object.fromEntries(Object.entries(o).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) as T;
}

/** is_numeric() */
export function isNumeric(v: unknown): boolean {
  if (typeof v === "number") return Number.isFinite(v);
  return typeof v === "string" && /^\s*[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?\s*$/.test(v);
}

/** Ep so kieu PHP ("12abc" -> 12, null -> 0). */
export function num(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "bigint") return Number(v);
  if (typeof v === "boolean") return v ? 1 : 0;
  const m = String(v ?? "").trim().match(/^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?/);
  return m ? Number(m[0]) : 0;
}

/** number_format($n, $decimals, '.', '') */
export function fixed(n: number, decimals = 2): string {
  const f = 10 ** decimals;
  return (Math.round(n * f + Number.EPSILON * Math.sign(n)) / f).toFixed(decimals);
}

/** number_format($n) — ngan cach hang nghin bang dau phay. */
export function numberFormat(n: unknown): string {
  return Math.round(num(n))
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** str_pad($s, $len, '0', STR_PAD_LEFT) */
export function padLeft(s: unknown, len: number): string {
  return String(s).padStart(len, "0");
}

/** ucfirst() */
export function ucfirst(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Loi tu `echo $e->getMessage() . $e->getCode(); die();` cua CartService. */
export class PhpException extends Error {
  constructor(
    message: string,
    public code = 0,
  ) {
    super(message);
  }
}
