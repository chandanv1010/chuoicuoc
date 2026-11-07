/**
 * Tien te cua storefront: dung chung cau hinh va ham voi admin (@/lib/money).
 * Doi tien te chi can sua CURRENCY trong src/lib/money.ts. Cot gia trong DB la
 * DECIMAL(12,2) USD (24.99 = $24.99).
 * Dung duoc ca o server lan client component (khong import server-only).
 */
import { CURRENCY as BASE, formatMoney, moneyParts } from "@/lib/money";

export { formatMoney, moneyNumber, parseMoney, toCents, fromCents, sumLines, mulMoney, addMoney, subMoney } from "@/lib/money";

export const CURRENCY = { ...BASE, fractionDigits: BASE.decimals } as const;

/** 1234 -> "$1,234.00"; 24.99 / Decimal("24.99") -> "$24.99" */
export function formatPrice(value: unknown): string {
  return formatMoney(value);
}

/** Tach gia de hien kieu Amazon: $ 14 .00 (phan xu nho phia tren). */
export function priceParts(value: unknown): { symbol: string; whole: string; fraction: string } {
  const { symbol, whole, fraction } = moneyParts(value);
  return { symbol, whole, fraction };
}
