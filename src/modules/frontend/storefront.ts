import "server-only";
import { Prisma } from "@prisma/client";
import { cache } from "react";
import { db } from "@/lib/db";
import { moneyNumber } from "@/lib/money";
import { FRONTEND_LANGUAGE } from "./core";
import { decodeAlbum } from "./product";
import { PRODUCT_REVIEWABLE } from "./store";

/**
 * Truy van du lieu cho giao dien storefront (kieu Amazon): the san pham kem
 * gia + danh gia, loc theo danh muc / gia / mau / sao, du lieu trang chu, bien the
 * cua trang chi tiet. Chi doc DB; handler gio hang/dat hang van nam o shop/*.
 */

const LANG = FRONTEND_LANGUAGE;
/** reviews.status = 1: da phe duyet (messages.status cua admin) */
const APPROVED = 1;

export type StoreProduct = {
  id: number;
  name: string;
  canonical: string | null;
  image: string | null;
  price: number;
  code: string | null;
  catalogueId: number;
  rating: number;
  reviews: number;
  hasVariants: boolean;
  createdAt: Date | null;
};

type Row = {
  id: bigint;
  name: string;
  canonical: string | null;
  image: string | null;
  price: number;
  code: string | null;
  product_catalogue_id: number;
  rating: number | string | null;
  reviews: bigint | number | null;
  variants: bigint | number | null;
  created_at: Date | null;
};

const SELECT = Prisma.sql`
  SELECT p.id, pl.name, pl.canonical, p.image, p.price, p.code, p.product_catalogue_id, p.created_at,
    (SELECT AVG(r.score) FROM reviews r WHERE r.reviewable_type = ${PRODUCT_REVIEWABLE} AND r.reviewable_id = p.id AND r.status = ${APPROVED}) AS rating,
    (SELECT COUNT(*) FROM reviews r WHERE r.reviewable_type = ${PRODUCT_REVIEWABLE} AND r.reviewable_id = p.id AND r.status = ${APPROVED}) AS reviews,
    (SELECT COUNT(*) FROM product_variants pv WHERE pv.product_id = p.id AND pv.deleted_at IS NULL) AS variants
  FROM products p
  JOIN product_language pl ON pl.product_id = p.id AND pl.language_id = ${LANG}`;

const BASE_WHERE = Prisma.sql`p.publish = 2 AND p.deleted_at IS NULL`;

function mapRow(r: Row): StoreProduct {
  return {
    id: Number(r.id),
    name: r.name,
    canonical: r.canonical,
    image: r.image,
    price: moneyNumber(r.price),
    code: r.code,
    catalogueId: Number(r.product_catalogue_id),
    rating: r.rating === null ? 0 : Number(r.rating),
    reviews: Number(r.reviews ?? 0),
    hasVariants: Number(r.variants ?? 0) > 0,
    createdAt: r.created_at,
  };
}

/** San pham thuoc danh muc (ke ca danh muc con) qua bang product_catalogue_product, giong ProductService::paginate. */
function inCatalogue(catId: number) {
  return Prisma.sql`EXISTS (
    SELECT 1 FROM product_catalogue_product pcp
    JOIN product_catalogues c ON c.id = pcp.product_catalogue_id
    JOIN product_catalogues root ON root.id = ${catId}
    WHERE pcp.product_id = p.id AND c.lft >= root.lft AND c.rgt <= root.rgt AND c.deleted_at IS NULL)`;
}

async function list(where: Prisma.Sql[], order: Prisma.Sql, limit: number, offset = 0) {
  const rows = await db.$queryRaw<Row[]>`
    ${SELECT}
    WHERE ${Prisma.join([BASE_WHERE, ...where], " AND ")}
    ORDER BY ${order}
    LIMIT ${limit} OFFSET ${offset}`;
  return rows.map(mapRow);
}

/** San pham chi dinh theo id, giu dung thu tu (khoi "Chọn tay" cua trinh dung giao dien). */
export async function productsByIds(ids: number[]): Promise<StoreProduct[]> {
  if (!ids.length) return [];
  const rows = await list([Prisma.sql`p.id IN (${Prisma.join(ids)})`], Prisma.sql`p.id DESC`, ids.length);
  return ids.map((id) => rows.find((r) => r.id === id)).filter((r): r is StoreProduct => !!r);
}

/* --------------------------------- Danh muc -------------------------------- */

export type StoreCatalogue = { id: number; name: string; canonical: string | null; images: string[]; count: number };

/**
 * Moi danh muc dang hien (ca danh muc con) + 4 anh san pham dau tien,
 * xep theo cay (lft). So luong / anh tinh ca danh muc con.
 */
export const getStoreCatalogues = cache(async (): Promise<StoreCatalogue[]> => {
  const cats = await db.$queryRaw<{ id: bigint; name: string; canonical: string | null }[]>`
    SELECT pc.id, pcl.name, pcl.canonical FROM product_catalogues pc
    JOIN product_catalogue_language pcl ON pcl.product_catalogue_id = pc.id AND pcl.language_id = ${LANG}
    WHERE pc.publish = 2 AND pc.deleted_at IS NULL
    ORDER BY pc.lft ASC, pc.id ASC`;
  return Promise.all(
    cats.map(async (c) => {
      const items = await list([inCatalogue(Number(c.id))], Prisma.sql`p.\`order\` DESC, p.id DESC`, 50);
      return {
        id: Number(c.id),
        name: c.name,
        canonical: c.canonical,
        images: items.map((i) => i.image).filter((x): x is string => !!x).slice(0, 4),
        count: items.length,
      };
    }),
  );
});

/* --------------------------------- Trang chu -------------------------------- */

export async function getHomeProducts() {
  const [bestSellers, christmas, newest, personalized] = await Promise.all([
    // Ban chay: tong so luong trong order_product, hoa thi theo thu tu quan tri
    db.$queryRaw<Row[]>`
      ${SELECT}
      LEFT JOIN (SELECT product_id, SUM(qty) AS sold FROM order_product GROUP BY product_id) s ON s.product_id = p.id
      WHERE ${BASE_WHERE}
      ORDER BY COALESCE(s.sold, 0) DESC, p.\`order\` DESC, p.id ASC
      LIMIT 16`.then((r) => r.map(mapRow)),
    list([Prisma.sql`pl.name LIKE ${"%Christmas%"}`], Prisma.sql`p.id DESC`, 16),
    list([], Prisma.sql`p.created_at DESC, p.id DESC`, 16),
    list([Prisma.sql`(pl.name LIKE ${"%Personalized%"} OR pl.name LIKE ${"%Custom%"})`], Prisma.sql`p.id DESC`, 4),
  ]);
  return { bestSellers, christmas, newest, personalized };
}

/* ------------------------------- Tim kiem / loc ------------------------------ */

export const SORTS = {
  featured: "Nổi bật",
  price_asc: "Giá: Thấp đến cao",
  price_desc: "Giá: Cao đến thấp",
  newest: "Mới nhất",
  rating: "Đánh giá cao",
} as const;
export type SortKey = keyof typeof SORTS;

export const PRICE_RANGES: { key: string; label: string; min: number | null; max: number | null }[] = [
  { key: "0-300000", label: "Dưới 300.000₫", min: null, max: 300000 },
  { key: "300000-500000", label: "300.000₫ - 500.000₫", min: 300000, max: 500000 },
  { key: "500000-1000000", label: "500.000₫ - 1.000.000₫", min: 500000, max: 1000000 },
  { key: "1000000-", label: "Trên 1.000.000₫", min: 1000000, max: null },
];

export type SearchFilters = {
  keyword: string;
  catalogueId: number | null;
  price: string | null;
  priceMin: number | null;
  priceMax: number | null;
  color: number | null;
  rating: number | null;
  sort: SortKey;
};

/** Doc bo loc tu query string (giu tham so cu: keyword, product_catalogue_id, sort). */
export function readFilters(query: [string, string][], catalogueId: number | null): SearchFilters {
  const q = new Map(query);
  const int = (k: string) => {
    const m = String(q.get(k) ?? "").match(/^\d+$/);
    return m ? Number(m[0]) : null;
  };
  // low_price / high_price nhan ca xu (24.99)
  const money = (k: string) => {
    const v = String(q.get(k) ?? "").trim();
    return /^\d+(\.\d{1,2})?$/.test(v) ? Number(v) : null;
  };
  const range = PRICE_RANGES.find((r) => r.key === q.get("price")) ?? null;
  const rawSort = q.get("sort") ?? "featured";
  // gia tri cu cua ban Laravel: oldest -> newest (gan nhat co the)
  const sort = (rawSort in SORTS ? rawSort : rawSort === "oldest" ? "newest" : "featured") as SortKey;
  return {
    keyword: (q.get("keyword") ?? "").trim(),
    catalogueId: int("product_catalogue_id") || catalogueId,
    price: range?.key ?? null,
    priceMin: money("low_price") ?? range?.min ?? null,
    priceMax: money("high_price") ?? range?.max ?? null,
    color: int("color"),
    rating: int("rating"),
    sort,
  };
}

const RATING_SQL = Prisma.sql`(SELECT AVG(r.score) FROM reviews r WHERE r.reviewable_type = ${PRODUCT_REVIEWABLE} AND r.reviewable_id = p.id AND r.status = ${APPROVED})`;

export async function searchProducts(f: SearchFilters, page: number, perPage: number) {
  const where: Prisma.Sql[] = [];
  if (f.keyword) where.push(Prisma.sql`(pl.name LIKE ${`%${f.keyword}%`} OR p.code LIKE ${`%${f.keyword}%`})`);
  if (f.catalogueId) where.push(inCatalogue(f.catalogueId));
  if (f.priceMin !== null) where.push(Prisma.sql`p.price >= ${f.priceMin}`);
  if (f.priceMax !== null) where.push(Prisma.sql`p.price <= ${f.priceMax}`);
  if (f.color)
    where.push(Prisma.sql`EXISTS (SELECT 1 FROM product_variants pv JOIN product_variant_attribute pva ON pva.product_variant_id = pv.id
      WHERE pv.product_id = p.id AND pv.deleted_at IS NULL AND pva.attribute_id = ${f.color})`);
  if (f.rating) where.push(Prisma.sql`COALESCE(${RATING_SQL}, 0) >= ${f.rating}`);

  let order = Prisma.sql`p.\`order\` DESC, p.id DESC`;
  if (f.sort === "price_asc") order = Prisma.sql`p.price ASC, p.id DESC`;
  else if (f.sort === "price_desc") order = Prisma.sql`p.price DESC, p.id DESC`;
  else if (f.sort === "newest") order = Prisma.sql`p.created_at DESC, p.id DESC`;
  else if (f.sort === "rating") order = Prisma.sql`COALESCE(${RATING_SQL}, 0) DESC, p.id DESC`;

  const all = [BASE_WHERE, ...where];
  const [count] = await db.$queryRaw<{ total: bigint }[]>`
    SELECT COUNT(*) AS total FROM products p
    JOIN product_language pl ON pl.product_id = p.id AND pl.language_id = ${LANG}
    WHERE ${Prisma.join(all, " AND ")}`;
  const items = await list(where, order, perPage, (page - 1) * perPage);
  return { items, total: Number(count?.total ?? 0) };
}

/** Bo loc mau: gia tri cua nhom thuoc tinh "Color" dang gan voi bien the san pham. */
export const getColorFacets = cache(async (): Promise<{ id: number; name: string }[]> => {
  const rows = await db.$queryRaw<{ id: bigint; name: string }[]>`
    SELECT DISTINCT a.id, al.name FROM attributes a
    JOIN attribute_language al ON al.attribute_id = a.id AND al.language_id = ${LANG}
    JOIN attribute_catalogue_language acl ON acl.attribute_catalogue_id = a.attribute_catalogue_id AND acl.language_id = ${LANG}
    JOIN product_variant_attribute pva ON pva.attribute_id = a.id
    JOIN product_variants pv ON pv.id = pva.product_variant_id AND pv.deleted_at IS NULL
    WHERE acl.name IN ('Color', 'Colour') AND a.deleted_at IS NULL
    ORDER BY al.name`;
  return rows.map((r) => ({ id: Number(r.id), name: r.name }));
});

/* ------------------------------- Chi tiet san pham ------------------------------ */

export type VariantGroup = { id: number; name: string; options: { id: number; name: string }[] };
export type VariantItem = { uuid: string; code: string; sku: string | null; price: number; quantity: number; image: string | null };

export async function getProductPurchaseData(productId: bigint) {
  const [p] = await db.$queryRaw<{ price: number; stock: number; code: string | null; attributeCatalogue: string | null; attribute: string | null; album: string | null }[]>`
    SELECT price, stock, code, attributeCatalogue, attribute, album FROM products WHERE id = ${productId} LIMIT 1`;
  const variants = await db.$queryRaw<{ uuid: string; code: string | null; sku: string | null; price: number; quantity: number; album: string | null }[]>`
    SELECT uuid, code, sku, price, quantity, album FROM product_variants
    WHERE product_id = ${productId} AND deleted_at IS NULL ORDER BY id`;

  let groups: VariantGroup[] = [];
  if (variants.length) {
    // cac attribute_id that su dung trong bien the -> nhom theo attribute_catalogue
    const ids = [...new Set(variants.flatMap((v) => String(v.code ?? "").split(",").map((x) => Number(x.trim())).filter((x) => x > 0)))];
    if (ids.length) {
      const rows = await db.$queryRaw<{ id: bigint; name: string; cat_id: bigint; cat_name: string }[]>`
        SELECT a.id, al.name, ac.id AS cat_id, acl.name AS cat_name FROM attributes a
        JOIN attribute_language al ON al.attribute_id = a.id AND al.language_id = ${LANG}
        JOIN attribute_catalogues ac ON ac.id = a.attribute_catalogue_id
        JOIN attribute_catalogue_language acl ON acl.attribute_catalogue_id = ac.id AND acl.language_id = ${LANG}
        WHERE a.id IN (${Prisma.join(ids)})`;
      // thu tu nhom + gia tri theo cau hinh san pham (products.attributeCatalogue / attribute)
      const catOrder = parseIds(p?.attributeCatalogue);
      const attrOrder = parseAttr(p?.attribute);
      const byCat = new Map<number, VariantGroup>();
      for (const r of rows) {
        const cid = Number(r.cat_id);
        if (!byCat.has(cid)) byCat.set(cid, { id: cid, name: r.cat_name, options: [] });
        byCat.get(cid)!.options.push({ id: Number(r.id), name: r.name });
      }
      groups = [...byCat.values()].sort((a, b) => idx(catOrder, a.id) - idx(catOrder, b.id) || a.id - b.id);
      for (const g of groups) {
        const order = attrOrder[String(g.id)] ?? [];
        g.options.sort((a, b) => idx(order, a.id) - idx(order, b.id) || a.id - b.id);
      }
    }
  }
  return {
    price: moneyNumber(p?.price),
    stock: Number(p?.stock ?? 0),
    groups,
    variants: variants.map<VariantItem>((v) => ({
      uuid: v.uuid,
      code: String(v.code ?? ""),
      sku: v.sku,
      price: moneyNumber(v.price),
      quantity: Number(v.quantity),
      image: (v.album ?? "").split(",").map((s) => s.trim()).filter(Boolean)[0] ?? null,
    })),
  };
}

function idx(list: number[], v: number) {
  const i = list.indexOf(v);
  return i < 0 ? Number.MAX_SAFE_INTEGER : i;
}
function parseIds(s: string | null | undefined): number[] {
  try {
    const v = JSON.parse(s ?? "[]");
    return (Array.isArray(v) ? v : Object.values(v ?? {})).map(Number);
  } catch {
    return [];
  }
}
function parseAttr(s: string | null | undefined): Record<string, number[]> {
  try {
    const v = JSON.parse(s ?? "{}") as Record<string, unknown>;
    const out: Record<string, number[]> = {};
    for (const [k, arr] of Object.entries(v ?? {})) out[k] = (Array.isArray(arr) ? arr : Object.values(arr ?? {})).map(Number);
    return out;
  } catch {
    return {};
  }
}

export { decodeAlbum };

export type StoreReview = { id: number; fullname: string; score: number; description: string; image: string | null; created_at: Date | null };

export async function getProductReviews(productId: bigint) {
  const rows = await db.$queryRaw<{ id: bigint; fullname: string; score: number; description: string; image: string | null; created_at: Date | null }[]>`
    SELECT id, fullname, score, description, image, created_at FROM reviews
    WHERE reviewable_type = ${PRODUCT_REVIEWABLE} AND reviewable_id = ${productId} AND status = ${APPROVED}
    ORDER BY created_at DESC, id DESC LIMIT 50`;
  const reviews: StoreReview[] = rows.map((r) => ({ ...r, id: Number(r.id), score: Math.max(0, Math.min(5, Number(r.score))) }));
  const histogram = [5, 4, 3, 2, 1].map((s) => ({ stars: s, count: reviews.filter((r) => Math.round(r.score) === s).length }));
  const average = reviews.length ? reviews.reduce((t, r) => t + r.score, 0) / reviews.length : 0;
  return { reviews, histogram, average, total: reviews.length };
}

export async function getRelatedStoreProducts(productId: bigint, catalogueId: number) {
  const where = [Prisma.sql`p.id != ${productId}`];
  const same = catalogueId ? await list([...where, Prisma.sql`p.product_catalogue_id = ${catalogueId}`], Prisma.sql`p.\`order\` DESC, p.id DESC`, 16) : [];
  if (same.length >= 4) return same;
  const more = await list(where, Prisma.sql`p.id DESC`, 16 - same.length);
  const seen = new Set(same.map((x) => x.id));
  return [...same, ...more.filter((x) => !seen.has(x.id))];
}

/* ------------------------------------ Gio hang ----------------------------------- */

export type CartLine = {
  rowId: string;
  productId: number;
  name: string;
  variant: string;
  canonical: string | null;
  image: string | null;
  qty: number;
  price: number;
  gift: boolean;
};

/** Thong tin hien thi cho cac dong gio (sau remakeCart): ten san pham, ten bien the, link. */
export async function cartLines(
  items: { rowId: string; id: string | number; name: string; qty: number | string; price: number; image?: string | null; options: Record<string, unknown> }[],
): Promise<CartLine[]> {
  const ids = [...new Set(items.map((i) => String(i.id).split("_")[0]).filter((x) => /^\d+$/.test(x)))];
  const rows = ids.length
    ? await db.$queryRaw<{ id: bigint; name: string; canonical: string | null; image: string | null }[]>`
        SELECT p.id, pl.name, pl.canonical, p.image FROM products p
        JOIN product_language pl ON pl.product_id = p.id AND pl.language_id = ${LANG}
        WHERE p.id IN (${Prisma.join(ids)})`
    : [];
  const map = new Map(rows.map((r) => [String(r.id), r]));
  return items.map((i) => {
    const pid = String(i.id).split("_")[0];
    const p = map.get(pid);
    const variant = p && i.name.startsWith(p.name) ? i.name.slice(p.name.length).trim() : "";
    return {
      rowId: i.rowId,
      productId: Number(pid),
      name: p?.name ?? i.name,
      variant,
      canonical: p?.canonical ?? null,
      image: i.image || p?.image || null,
      qty: Number(i.qty) || 0,
      price: moneyNumber(i.price),
      gift: i.options.gifts !== undefined && i.options.gifts !== null,
    };
  });
}
