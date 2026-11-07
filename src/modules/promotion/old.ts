import "server-only";
import { getFlash } from "@/lib/flash";
import { laravelInput } from "./php";

/**
 * old($key, $default) cua Blade (Arr::get tren _old_input da qua TrimStrings +
 * ConvertEmptyStringsToNull). Viet rieng vi oldInput() trong @/lib/flash dang
 * luon tra ve $default (xem muc "Can sua nen" trong bao cao).
 */
export async function laravelOld() {
  const flashed = (await getFlash()).old;
  const data = flashed ? (laravelInput(flashed) as Record<string, unknown>) : null;
  return function get<T = unknown>(field: string, fallback?: T): T {
    if (!data) return fallback as T;
    let node: unknown = data;
    for (const part of field.split(".")) {
      if (node && typeof node === "object" && part in (node as Record<string, unknown>)) {
        node = (node as Record<string, unknown>)[part];
      } else {
        return fallback as T;
      }
    }
    return node as T;
  };
}

export type Old = Awaited<ReturnType<typeof laravelOld>>;
