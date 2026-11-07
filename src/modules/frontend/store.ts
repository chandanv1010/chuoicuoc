/**
 * Cau hinh co dinh cua storefront (email ho tro, van chuyen). Ten shop KHONG nam o day:
 * lay bang siteName() (@/lib/site, tu systems.homepage_company).
 * Thong tin lien he hien thi uu tien bang `systems` (contact_email...), cac
 * hang so duoi day chi la gia tri du phong. Dung duoc o ca server va client.
 */
export const STORE = {
  /** Khau hieu (footer, tieu de trang chu khi chua dat SEO): env NEXT_PUBLIC_STORE_TAGLINE */
  tagline: process.env.NEXT_PUBLIC_STORE_TAGLINE || "Quality products, delivered to your door",
  /** Email nhan yeu cau ve du lieu / quyen rieng tu — chu shop sua tai day hoac o systems.contact_email */
  supportEmail: "support@example.com",
  /** Link shop Etsy cua site (env ETSY_SHOP_URL, chi doc o server); trong -> an cac link Etsy. */
  etsyUrl: process.env.ETSY_SHOP_URL ?? "",
  /**
   * Noi gui hang / noi giao / xuat xu chi de hien thi; trong -> an dong tuong ung.
   * NEXT_PUBLIC_ de server va client (product-card trong editor) cung mot gia tri.
   */
  shipsFrom: process.env.NEXT_PUBLIC_STORE_SHIPS_FROM ?? "",
  shipTo: process.env.NEXT_PUBLIC_STORE_SHIP_TO ?? "",
  origin: process.env.NEXT_PUBLIC_STORE_ORIGIN ?? "",
  /** So ngay giao hang du kien */
  deliveryDays: [10, 18] as [number, number],
  legalUpdated: "October 26, 2026",
} as const;

/** reviews.reviewable_type cua san pham (morph class Laravel) */
export const PRODUCT_REVIEWABLE = ["App", "Models", "Product"].join(String.fromCharCode(92));

/** "Arrives Nov 4 - Nov 12" tinh tu hom nay */
export function deliveryWindow(from = new Date()): string {
  const fmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
  const add = (d: number) => new Date(from.getTime() + d * 86_400_000);
  return `${fmt.format(add(STORE.deliveryDays[0]))} – ${fmt.format(add(STORE.deliveryDays[1]))}`;
}

/**
 * Ngay kieu My ("Oct 25, 2026"). Cot DATETIME luu gio dia phuong Laravel nhung
 * Prisma doc nhu UTC -> doc bang UTC (xem convertDateTime trong @/lib/helpers).
 */
export function usDate(d: Date | null | undefined, withTime = false): string {
  if (!d) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
    ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}),
  }).format(d);
}
