import "server-only";
import { Prisma } from "@prisma/client";
import { cache } from "react";
import { db } from "@/lib/db";
import { addslashes, jsonDecode, phpTruthy } from "./helpers";
import { makePaginator, type Paginator } from "./paginator";

/**
 * Phan doc du lieu san pham cho website, thay:
 *   - ProductCatalogueRepository::getProductCatalogueById
 *   - ProductRepository::getProductById
 *   - ProductService::paginate (+ whereRaw)
 *   - ProductCatalogueController::danhSachDanhMuc / nhanhDangXem
 *   - ProductController::sanPhamLienQuan
 */

/** $request->integer('x'): (int) cua PHP. */
export function phpInt(v: string | undefined): number {
  const m = String(v ?? "").trim().match(/^[+-]?\d+/);
  return m ? parseInt(m[0], 10) : 0;
}

export type ProductCatalogue = {
  id: bigint;
  parent_id: number;
  lft: number;
  rgt: number;
  image: string | null;
  icon: string | null;
  name: string;
  description: string | null;
  content: string | null;
  meta_title: string | null;
  meta_keyword: string | null;
  meta_description: string | null;
  canonical: string | null;
};

/** getProductCatalogueById($id, $language): khong loc publish, chi bo ban ghi da xoa. */
export const getProductCatalogueById = cache(async (id: bigint, languageId: bigint) => {
  const rows = await db.$queryRaw<ProductCatalogue[]>`
    SELECT pc.id, pc.parent_id, pc.lft, pc.rgt, pc.image, pc.icon,
           tb2.name, tb2.description, tb2.content, tb2.meta_title, tb2.meta_keyword, tb2.meta_description, tb2.canonical
    FROM product_catalogues pc
    JOIN product_catalogue_language tb2 ON tb2.product_catalogue_id = pc.id
    WHERE tb2.language_id = ${languageId} AND pc.id = ${id} AND pc.deleted_at IS NULL
    LIMIT 1`;
  return rows[0] ?? null;
});

export type ProductCard = {
  id: bigint;
  image: string | null;
  code: string | null;
  name: string;
  description: string | null;
  canonical: string | null;
};

const PRODUCT_PER_PAGE = 8;

/**
 * ProductService::paginate($request, $languageId, $productCatalogue, $page, ['path' => ...]).
 * Giu dung cac tham so query cua ban goc: keyword, publish, product_catalogue_id, sort.
 * Ban goc KHONG loc publish (chi loc khi co ?publish=), INNER JOIN bang
 * product_catalogue_product nen san pham chua gan danh muc khong hien.
 */
export async function paginateProducts(opts: {
  query: [string, string][];
  languageId: bigint;
  catalogue: { id: bigint } | null;
  page: number;
  path: string;
}): Promise<Paginator<ProductCard>> {
  const q = new Map(opts.query);
  const keyword = addslashes(q.get("keyword") ?? "");
  const publish = phpInt(q.get("publish"));
  const reqCat = phpInt(q.get("product_catalogue_id"));
  const sort = q.get("sort") ?? "newest";

  const conds: Prisma.Sql[] = [];
  if (keyword !== "") conds.push(Prisma.sql`tb2.name LIKE ${`%${keyword}%`}`);
  if (publish) conds.push(Prisma.sql`products.publish = ${publish}`);
  conds.push(Prisma.sql`tb2.language_id = ${opts.languageId}`);
  if (reqCat > 0 || opts.catalogue) {
    const catId = reqCat > 0 ? BigInt(reqCat) : opts.catalogue!.id;
    conds.push(Prisma.sql`tb3.product_catalogue_id IN (
      SELECT id FROM product_catalogues
      JOIN product_catalogue_language ON product_catalogues.id = product_catalogue_language.product_catalogue_id
      WHERE lft >= (SELECT lft FROM product_catalogues as pc WHERE pc.id = ${catId})
        AND rgt <= (SELECT rgt FROM product_catalogues as pc WHERE pc.id = ${catId})
        AND product_catalogue_language.language_id = ${opts.languageId}
    )`);
  }
  conds.push(Prisma.sql`products.deleted_at IS NULL`);

  let orderBy = Prisma.sql`products.id DESC`;
  if (sort === "oldest") orderBy = Prisma.sql`products.id ASC`;
  else if (sort === "price_desc") orderBy = Prisma.sql`products.price DESC`;
  else if (sort === "price_asc") orderBy = Prisma.sql`products.price ASC`;

  const from = Prisma.sql`
    FROM products
    JOIN product_language as tb2 ON tb2.product_id = products.id
    JOIN product_catalogue_product as tb3 ON products.id = tb3.product_id
    WHERE ${Prisma.join(conds, " AND ")}`;
  const group = Prisma.sql`GROUP BY products.id, products.image, products.code, products.price, tb2.name, tb2.description, tb2.canonical`;

  const [count] = await db.$queryRaw<{ total: bigint }[]>`
    SELECT COUNT(*) AS total FROM (SELECT products.id ${from} ${group}) AS aggregate_table`;
  const total = Number(count?.total ?? 0);
  const items = await db.$queryRaw<ProductCard[]>`
    SELECT products.id, products.image, products.code, tb2.name, tb2.description, tb2.canonical
    ${from} ${group}
    ORDER BY ${orderBy}
    LIMIT ${PRODUCT_PER_PAGE} OFFSET ${(opts.page - 1) * PRODUCT_PER_PAGE}`;

  return makePaginator(items, total, PRODUCT_PER_PAGE, opts.page, opts.path, opts.query);
}

export type CatNode = {
  id: bigint;
  parent_id: number;
  icon: string | null;
  name: string;
  canonical: string | null;
  children: CatNode[];
};

/** danhSachDanhMuc() + dungCayDanhMuc(): cay danh muc theo parent_id. */
export const getCatalogueTree = cache(async (languageId: bigint): Promise<CatNode[]> => {
  const all = await db.$queryRaw<Omit<CatNode, "children">[]>`
    SELECT pc.id, pc.parent_id, pc.icon, pcl.name, pcl.canonical
    FROM product_catalogues pc
    JOIN product_catalogue_language pcl ON pcl.product_catalogue_id = pc.id AND pcl.language_id = ${languageId}
    WHERE pc.publish = 2 AND pc.deleted_at IS NULL
    ORDER BY pc.\`order\` ASC, pc.id ASC`;
  const ids = new Set(all.map((c) => Number(c.id)));
  const childrenOf = new Map<number, Omit<CatNode, "children">[]>();
  for (const c of all) {
    let parent = Number(c.parent_id);
    if (parent !== 0 && !ids.has(parent)) parent = 0; // cha bi an/xoa -> dua len goc
    if (!childrenOf.has(parent)) childrenOf.set(parent, []);
    childrenOf.get(parent)!.push(c);
  }
  const build = (parent: number): CatNode[] =>
    (childrenOf.get(parent) ?? []).map((c) => ({ ...c, children: build(Number(c.id)) }));
  return build(0);
});

/** nhanhDangXem(): chuoi id tu danh muc dang xem nguoc len goc (toi da 10 vong). */
export async function getBranch(current: number): Promise<number[]> {
  if (!current) return [];
  const out: number[] = [];
  let id = current;
  for (let i = 0; i < 10 && id; i++) {
    out.push(id);
    const row = await db.product_catalogues.findUnique({ where: { id: BigInt(id) }, select: { parent_id: true } });
    id = row ? Number(row.parent_id) : 0;
  }
  return out;
}

export type ProductDetail = {
  id: bigint;
  product_catalogue_id: number;
  image: string | null;
  album: string | null;
  code: string | null;
  iframe: string | null;
  specification: string | null;
  name: string;
  description: string | null;
  content: string | null;
  meta_title: string | null;
  meta_keyword: string | null;
  meta_description: string | null;
  canonical: string | null;
};

/** getProductById(): khong loc publish (tham so $condition bi bo qua o ban goc). */
export const getProductById = cache(async (id: bigint, languageId: bigint) => {
  const rows = await db.$queryRaw<ProductDetail[]>`
    SELECT p.id, p.product_catalogue_id, p.image, p.album, p.code, p.iframe, p.specification,
           tb2.name, tb2.description, tb2.content, tb2.meta_title, tb2.meta_keyword, tb2.meta_description, tb2.canonical
    FROM products p
    JOIN product_language tb2 ON tb2.product_id = p.id
    WHERE tb2.language_id = ${languageId} AND p.id = ${id} AND p.deleted_at IS NULL
    LIMIT 1`;
  return rows[0] ?? null;
});

/** Album JSON -> mang duong dan (array_filter). JSON hong -> []. */
export function decodeAlbum(album: string | null | undefined): string[] {
  if (!album) return [];
  const d = jsonDecode<unknown>(album);
  if (!d || typeof d !== "object") return [];
  return Object.values(d as Record<string, unknown>).filter(phpTruthy).map(String);
}

/** sanPhamLienQuan(): 4 san pham khac cung danh muc. */
export async function getRelatedProducts(product: ProductDetail, languageId: bigint): Promise<ProductCard[]> {
  if (!product.product_catalogue_id) return [];
  return db.$queryRaw<ProductCard[]>`
    SELECT p.id, p.code, p.image, pl.name, pl.canonical, pl.description
    FROM products p
    JOIN product_language pl ON pl.product_id = p.id AND pl.language_id = ${languageId}
    WHERE p.product_catalogue_id = ${product.product_catalogue_id} AND p.id != ${product.id}
      AND p.publish = 2 AND p.deleted_at IS NULL
    ORDER BY p.\`order\` ASC, p.id DESC
    LIMIT 4`;
}
