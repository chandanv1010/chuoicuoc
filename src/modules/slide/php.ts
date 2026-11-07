/**
 * Mot so hanh vi PHP/Laravel ma cac module slide/menu/distribution/home-feature/dealer
 * can giong het (dat tam o day vi khong duoc sua src/lib — xem bao cao "Can sua nen").
 */
import type { Input } from "@/lib/http";

/**
 * Middleware TrimStrings + ConvertEmptyStringsToNull cua Laravel:
 * $request->input('x') tra ve chuoi da trim, chuoi rong thanh null.
 */
export function inputOf(input: Input, key: string): string | null {
  const v = input[key];
  return phpString(v);
}

export function phpString(v: unknown): string | null {
  if (v === undefined || v === null || v instanceof File) return null;
  if (typeof v === "object") return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

/** Ap TrimStrings + ConvertEmptyStringsToNull de quy cho mang/obj (vd setting[...], slide[...][]). */
export function phpClean(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(phpClean);
  if (v && typeof v === "object" && !(v instanceof File)) {
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, phpClean(x)]));
  }
  return phpString(v);
}

/** $request->integer('x') */
export function phpInteger(input: Input, key: string): number {
  const s = phpString(input[key]);
  if (s === null) return 0;
  const n = Number.parseInt(s, 10);
  return Number.isNaN(n) ? 0 : n;
}

/**
 * Mang PHP co thu tu: Map giu dung thu tu khoa. Dung khi can mo phong phep
 * cong mang `$a + $b` cua PHP (vd SlideService::updateSlideOrder).
 */
export type PhpArray = Map<string, unknown>;

export function toPhpArray(v: unknown): PhpArray {
  const m: PhpArray = new Map();
  if (Array.isArray(v)) v.forEach((x, i) => m.set(String(i), x));
  else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) m.set(k, x);
  return m;
}

/** $a + $b: giu khoa cua $a, them khoa cua $b chua co. */
export function phpUnion(a: PhpArray, b: PhpArray): PhpArray {
  const out: PhpArray = new Map(a);
  for (const [k, v] of b) if (!out.has(k)) out.set(k, v);
  return out;
}

/**
 * json_encode() mac dinh cua PHP (cast 'json'/'array' cua Eloquent):
 * escape "/" thanh "\/", ky tu ngoai ASCII thanh \uXXXX, mang co khoa 0..n-1 thanh list.
 */
export function phpJsonEncode(v: unknown): string {
  if (v === null || v === undefined) return "null";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "0";
  if (typeof v === "bigint") return v.toString();
  if (typeof v === "string") return encodeString(v);
  if (v instanceof Map) {
    const keys = [...v.keys()];
    if (keys.every((k, i) => k === String(i))) return `[${[...v.values()].map(phpJsonEncode).join(",")}]`;
    return `{${[...v.entries()].map(([k, x]) => `${encodeString(k)}:${phpJsonEncode(x)}`).join(",")}}`;
  }
  if (Array.isArray(v)) return `[${v.map(phpJsonEncode).join(",")}]`;
  if (typeof v === "object") {
    const entries = Object.entries(v as Record<string, unknown>);
    if (entries.length && entries.every(([k], i) => k === String(i))) return `[${entries.map(([, x]) => phpJsonEncode(x)).join(",")}]`;
    if (!entries.length) return "[]"; // mang PHP rong
    return `{${entries.map(([k, x]) => `${encodeString(k)}:${phpJsonEncode(x)}`).join(",")}}`;
  }
  return "null";
}

function encodeString(s: string): string {
  let out = '"';
  for (const ch of s) {
    const c = ch.codePointAt(0)!;
    if (ch === '"') out += '\\"';
    else if (ch === "\\") out += "\\\\";
    else if (ch === "/") out += "\\/";
    else if (ch === "\n") out += "\\n";
    else if (ch === "\r") out += "\\r";
    else if (ch === "\t") out += "\\t";
    else if (ch === "\b") out += "\\b";
    else if (ch === "\f") out += "\\f";
    else if (c < 0x20 || c > 0x7e) {
      if (c > 0xffff) {
        const hi = Math.floor((c - 0x10000) / 0x400) + 0xd800;
        const lo = ((c - 0x10000) % 0x400) + 0xdc00;
        out += `\\u${hi.toString(16).padStart(4, "0")}\\u${lo.toString(16).padStart(4, "0")}`;
      } else out += `\\u${c.toString(16).padStart(4, "0")}`;
    } else out += ch;
  }
  return `${out}"`;
}

/** json_decode($x, true) an toan: loi thi null. */
export function jsonDecode(s: string | null | undefined): unknown {
  if (!s) return null;
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

/** Gia tri hien thi trong Blade {{ $x }}: null -> "". */
export function e(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "boolean") return v ? "1" : "";
  return String(v);
}
