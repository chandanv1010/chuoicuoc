import "server-only";
import { str, type Input } from "@/lib/http";

/**
 * Tien ich chung cho payload cua module product/attribute.
 */

/**
 * Middleware TrimStrings + ConvertEmptyStringsToNull cua Laravel (app/Http/Kernel.php):
 * cat khoang trang 2 dau moi chuoi, chuoi rong -> null, ap dung de quy cho mang.
 */
export function laravelInput<T = Input>(value: T): T {
  if (typeof value === "string") {
    const t = value.trim();
    return (t === "" ? null : t) as T;
  }
  if (Array.isArray(value)) return value.map((v) => laravelInput(v)) as T;
  if (value && typeof value === "object" && !(value instanceof File)) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, laravelInput(v)])) as T;
  }
  return value;
}

/** json_encode() mac dinh cua PHP: escape "/" va ky tu ngoai ASCII thanh \uXXXX. */
export function phpJsonEncode(value: unknown): string {
  return JSON.stringify(value)
    .replace(/\//g, "\\/")
    .replace(/[\u0080-￿]/g, (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"));
}

/** Mang PHP: object co key 0..n-1 lien tuc thi json_encode ra list. */
export function phpArray(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(phpArray);
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.every(([k], i) => k === String(i))) return entries.map(([, v]) => phpArray(v));
    return Object.fromEntries(entries.map(([k, v]) => [k, phpArray(v)]));
  }
  return value;
}

/** empty() cua PHP cho gia tri input. */
function isEmptyValue(v: unknown) {
  if (v === undefined || v === null || v === "" || v === "0") return true;
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === "object") return Object.keys(v as object).length === 0;
  return false;
}

/** BaseService::formatJson($request, $inputName) */
export function formatJson(input: Input, name: string): string {
  const v = input[name];
  return isEmptyValue(v) ? "" : phpJsonEncode(phpArray(v));
}

/** BaseService::formatAlbum($request) */
export function formatAlbum(input: Input): string {
  return formatJson(input, "album");
}

/** Gia tri chuoi hoac null (input da qua laravelInput thi '' da thanh null). */
export function nullable(input: Input, k: string): string | null {
  return input[k] === undefined || input[k] === null || str(input, k) === "" ? null : str(input, k);
}

/* convert_price() (bo dau cham kieu VND) da bo: gia USD doc bang parseMoney() cua @/lib/money. */

/** Cot INT voi MySQL strict=false: chuoi khong phai so -> phan so o dau hoac 0; null giu null. */
export function mysqlInt(v: unknown): number {
  if (v === null || v === undefined) return 0;
  const m = String(v).trim().match(/^[+-]?\d+/);
  return m ? Number.parseInt(m[0], 10) : 0;
}
