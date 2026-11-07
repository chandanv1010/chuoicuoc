import "server-only";
import type { RuleFn } from "@/lib/validator";

/**
 * Rule between:min,max (numeric) — @/lib/validator chua ho tro (xem "Can sua nen").
 * Message mac dinh khong thay :min/:max duoc qua RuleFn; cac FormRequest dung rule nay deu co message rieng.
 */
export function numBetween(min: number, max: number): RuleFn {
  return ({ value }) => {
    if (value === null || value === undefined || value === "") return null;
    const s = String(value).trim();
    if (!/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(s)) return null; // rule numeric bao loi rieng
    const v = Number(s);
    return v < min || v > max ? "between" : null;
  };
}
