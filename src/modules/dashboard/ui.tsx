/**
 * Helper dung chung cho nhom "He thong" (user, permission, language, widget, lecturer...).
 * Giao dien da chuyen sang bo khoi src/components/admin/*; o day chi con xu ly input.
 */

const NO_TRIM = new Set(["password", "password_confirmation", "current_password"]);

/** Ap TrimStrings + ConvertEmptyStringsToNull cho ca input (de quy), giong $request->input(). */
export function laravelInput<T extends Record<string, unknown>>(input: T): T {
  const walk = (v: unknown, key: string): unknown => {
    if (typeof v === "string") {
      const s = NO_TRIM.has(key) ? v : v.trim();
      return s === "" ? null : s;
    }
    if (Array.isArray(v)) return v.map((x) => walk(x, ""));
    if (v && typeof v === "object" && !(v instanceof File)) {
      return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x, k)]));
    }
    return v;
  };
  return walk(input, "") as T;
}

/**
 * Middleware TrimStrings + ConvertEmptyStringsToNull cua Laravel:
 * chuoi duoc trim, rong thi thanh null (tru cac o password).
 */
export function nullIfEmpty(v: unknown, trim = true): string | null {
  if (v === undefined || v === null || v instanceof File || typeof v === "object") return null;
  const s = trim ? String(v).trim() : String(v);
  return s === "" ? null : s;
}

/** Gia tri bat ky -> chuoi cho defaultValue cua o nhap. */
export const s = (v: unknown) => (v === null || v === undefined ? "" : String(v));
