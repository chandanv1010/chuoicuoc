/**
 * Tien te dung chung cho admin + storefront (storefront ban bang USD co xu).
 *
 * - DB: moi cot tien la DECIMAL(12,2) (xem prisma/sql/2026-10-25-money-usd-decimal.sql).
 *   Prisma tra ve Prisma.Decimal; $queryRaw cung tra Decimal cho cot DECIMAL.
 * - Tinh toan: doi ve so nguyen xu (toCents) roi cong/tru/nhan, doi lai bang fromCents.
 *   Khong cong truc tiep so thuc (0.1 + 0.2).
 * - Hien thi: formatMoney() -> "$1,234.50". Nhap lieu admin: parseMoney() nhan
 *   "24.99", "1,234.50", "$24.99" -> "1234.50" (chuoi de ghi thang vao DECIMAL).
 * - JSON/ajax: moneyNumber() -> number 2 chu so thap phan (JS cu doc so).
 *
 * Khong import server-only / Prisma: dung duoc trong client component.
 */

export const CURRENCY = {
  code: "VND",
  symbol: "₫",
  locale: "vi-VN",
  /** so chu so thap phan */
  decimals: 0,
} as const;

const SCALE = 10 ** CURRENCY.decimals;

/**
 * Diem thuong (so nguyen) -> tien khi dung diem: 1 diem = $1.00 (ban VND: 1 diem = 1đ).
 * Diem duoc cong = floor(point_percent% x tong don USD) (src/modules/order/order.ts).
 */
export const POINT_VALUE = 1;

/** So diem -> so tien giam (number 2 chu so). */
export function pointsToMoney(points: unknown): number {
  const p = Math.trunc(Number(points) || 0);
  return fromCents(p * POINT_VALUE * SCALE);
}

/** Decimal cua Prisma (decimal.js) hoac doi tuong co toFixed(). */
type DecimalLike = { toFixed(dp?: number): string };
const isDecimalLike = (v: unknown): v is DecimalLike =>
  !!v && typeof v === "object" && typeof (v as { toFixed?: unknown }).toFixed === "function";

/**
 * Chuoi so thap phan (khong ky hieu, khong dau phay) -> xu, lam tron nua len (half away from zero).
 * Tra null neu khong phai so.
 */
function decimalStringToCents(s: string): number | null {
  const m = s.match(/^([+-])?(\d*)(?:\.(\d*))?$/);
  if (!m || (!m[2] && !m[3])) return null;
  const sign = m[1] === "-" ? -1 : 1;
  const whole = Number(m[2] || "0");
  const frac = (m[3] ?? "").padEnd(CURRENCY.decimals + 1, "0");
  let cents = whole * SCALE + Number(frac.slice(0, CURRENCY.decimals));
  if (Number(frac[CURRENCY.decimals]) >= 5) cents += 1;
  return sign * cents;
}

/**
 * Chuan hoa chuoi nguoi dung nhap: bo "$", "USD", khoang trang, dau phay ngan cach hang nghin.
 * Nhieu dau cham ("1.234.567", kieu VND cu) -> coi la ngan cach hang nghin.
 */
function normalizeInput(raw: string): string {
  let s = raw.trim().replace(/usd/gi, "").replace(/[$\s ]/g, "");
  // (24.99) kieu ke toan -> am
  if (/^\(.*\)$/.test(s)) s = `-${s.slice(1, -1)}`;
  s = s.replace(/,/g, "");
  if ((s.match(/\./g) ?? []).length > 1) s = s.replace(/\./g, "");
  return s;
}

/** Bat ky gia tri tien nao (number, chuoi nhap, Decimal, bigint, null) -> so nguyen xu. Khong hop le -> 0. */
export function toCents(v: unknown): number {
  if (v === null || v === undefined || v === "" || v === false) return 0;
  if (typeof v === "number") {
    if (!Number.isFinite(v)) return 0;
    // + epsilon de 1.005 -> 101 (24.99 * 100 = 2498.9999999999995)
    return Math.sign(v) * Math.round(Math.abs(v) * SCALE + 1e-7);
  }
  if (typeof v === "bigint") return Number(v) * SCALE;
  if (v === true) return SCALE;
  if (isDecimalLike(v)) return decimalStringToCents(v.toFixed(CURRENCY.decimals)) ?? 0;
  return decimalStringToCents(normalizeInput(String(v))) ?? 0;
}

/** Xu -> so tien (number, dung 2 chu so thap phan). */
export function fromCents(cents: number): number {
  return Math.round(cents) / SCALE;
}

/** Gia tri tien -> number lam tron xu (dung o ranh gioi JSON / ajax). */
export function moneyNumber(v: unknown): number {
  return fromCents(toCents(v));
}

/** Xu -> chuoi "1234.50" (ghi DB / gia tri input an). */
export function centsToString(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(Math.round(cents));
  return `${sign}${Math.floor(abs / SCALE)}.${String(abs % SCALE).padStart(CURRENCY.decimals, "0")}`;
}

/** Gia tri tien -> chuoi "1234.50". */
export function moneyString(v: unknown): string {
  return centsToString(toCents(v));
}

/**
 * Doc tien admin nhap: "24.99", "1,234.50", "$24.99", "24" -> "1234.50" / "24.00".
 * Rong hoac khong phai so -> null (handler tu quyet dinh: cot NOT NULL thi dung ?? "0.00").
 * Thay convertPrice()/mysqlInt() (bo moi ky tu khong phai so) cua ban VND.
 */
export function parseMoney(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? centsToString(toCents(v)) : null;
  if (isDecimalLike(v)) return centsToString(toCents(v));
  const s = normalizeInput(String(v));
  if (s === "") return null;
  const cents = decimalStringToCents(s);
  return cents === null ? null : centsToString(cents);
}

/**
 * Loc ky tu khi dang go o o nhap tien: chi giu so, dau phay, mot dau cham va toi da 2 chu so
 * sau dau cham ("$1,2a34.567" -> "1,234.56"). Dinh dang lai khi blur bang formatMoneyInput().
 */
export function sanitizeMoneyTyping(raw: string): string {
  let s = raw.replace(/[^0-9.,]/g, "");
  const dot = s.indexOf(".");
  if (dot >= 0) s = s.slice(0, dot + 1) + s.slice(dot + 1).replace(/[.,]/g, "").slice(0, CURRENCY.decimals);
  return s;
}

/** Gia tri o nhap sau blur: "1234.5" -> "1,234.50"; rong/khong hop le -> "". */
export function formatMoneyInput(v: unknown): string {
  const p = parseMoney(v);
  return p === null ? "" : formatMoneyPlain(p);
}

/** parseMoney() cho cot NOT NULL: khong hop le -> "0.00" (giong MySQL strict=false cua Laravel). */
export function parseMoneyOrZero(v: unknown): string {
  return parseMoney(v) ?? "0.00";
}

/* ------------------------------- Phep tinh (theo xu) ------------------------------- */

/** a + b + ... */
export function addMoney(...values: unknown[]): number {
  return fromCents(values.reduce<number>((t, v) => t + toCents(v), 0));
}

/** a - b - ... */
export function subMoney(a: unknown, ...values: unknown[]): number {
  return fromCents(values.reduce<number>((t, v) => t - toCents(v), toCents(a)));
}

/** don gia x so luong */
export function mulMoney(price: unknown, qty: unknown): number {
  const q = typeof qty === "number" ? qty : Number(qty);
  return fromCents(Math.round(toCents(price) * (Number.isFinite(q) ? q : 0)));
}

/** percent% cua so tien, lam tron toi xu. */
export function percentOf(amount: unknown, percent: unknown): number {
  const p = typeof percent === "number" ? percent : Number(String(percent ?? "").replace(/[^0-9.+-]/g, ""));
  return fromCents(Math.round((toCents(amount) * (Number.isFinite(p) ? p : 0)) / 100));
}

/** Tong cac dong (gia, so luong). */
export function sumLines(lines: Iterable<{ price: unknown; qty: unknown }>): number {
  let cents = 0;
  for (const l of lines) cents += Math.round(toCents(l.price) * Number(l.qty ?? 0));
  return fromCents(cents);
}

/* ---------------------------------- Hien thi ---------------------------------- */

const currencyFormatter = new Intl.NumberFormat(CURRENCY.locale, {
  style: "currency",
  currency: CURRENCY.code,
  minimumFractionDigits: CURRENCY.decimals,
  maximumFractionDigits: CURRENCY.decimals,
});

const plainFormatter = new Intl.NumberFormat(CURRENCY.locale, {
  minimumFractionDigits: CURRENCY.decimals,
  maximumFractionDigits: CURRENCY.decimals,
});

const compactFormatter = new Intl.NumberFormat(CURRENCY.locale, {
  style: "currency",
  currency: CURRENCY.code,
  notation: "compact",
  maximumFractionDigits: 1,
});

/** 1234.5 -> "$1,234.50"; -5 -> "-$5.00" */
export function formatMoney(v: unknown): string {
  return currencyFormatter.format(moneyNumber(v));
}

/** 1234.5 -> "1,234.50" (khong ky hieu, dung cho o nhap) */
export function formatMoneyPlain(v: unknown): string {
  return plainFormatter.format(moneyNumber(v));
}

/** Truc bieu do: 12500 -> "$12.5K" */
export function formatMoneyCompact(v: unknown): string {
  return compactFormatter.format(moneyNumber(v));
}

/** Tach gia de hien kieu Amazon: $ 14 .00 (phan xu nho phia tren). */
export function moneyParts(v: unknown): { symbol: string; whole: string; fraction: string; negative: boolean } {
  let symbol = "";
  let whole = "";
  let fraction = "";
  let negative = false;
  for (const p of currencyFormatter.formatToParts(moneyNumber(v))) {
    if (p.type === "currency") symbol += p.value;
    else if (p.type === "integer" || p.type === "group") whole += p.value;
    else if (p.type === "fraction") fraction += p.value;
    else if (p.type === "minusSign") negative = true;
  }
  return { symbol, whole: negative ? `-${whole}` : whole, fraction, negative };
}
