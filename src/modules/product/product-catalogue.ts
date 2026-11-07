import "server-only";
import { Prisma } from "@prisma/client";
import { CONTROLLERS } from "@/lib/constants";
import { db } from "@/lib/db";
import { now } from "@/lib/helpers";
import type { Input } from "@/lib/http";
import { str } from "@/lib/http";
import { slugify } from "@/lib/slug";
import { listParams, where, type SearchParams } from "@/server/admin-list";
import { nestedSet } from "@/server/nested-set";
import { saveRouter } from "@/server/router";
import { formatAlbum, nullable, phpArray, phpJsonEncode } from "./payload";

/**
 * ProductCatalogueRepository + ProductCatalogueService (app/Services/V1/Product/ProductCatalogueService.php).
 */
export const productCatalogueNested = (languageId: bigint) =>
  nestedSet({ table: "product_catalogues", foreignKey: "product_catalogue_id", languageId });

export type ProductCatalogueRow = {
  id: bigint;
  publish: number;
  image: string | null;
  level: number;
  order: number;
  name: string;
  canonical: string;
};

/** ProductCatalogueService::paginate — join product_catalogue_language, sap xep lft ASC. */
export async function paginateProductCatalogues(sp: SearchParams, languageId: bigint) {
  const { perPage, page, offset, keyword, publish } = listParams(sp);
  const cond = where([
    keyword ? Prisma.sql`tb2.name LIKE ${`%${keyword}%`}` : null,
    publish ? Prisma.sql`product_catalogues.publish = ${publish}` : null,
    Prisma.sql`tb2.language_id = ${languageId}`,
    Prisma.sql`product_catalogues.deleted_at IS NULL`,
  ]);
  const from = Prisma.sql`FROM product_catalogues JOIN product_catalogue_language AS tb2 ON tb2.product_catalogue_id = product_catalogues.id`;
  const [rows, count] = await Promise.all([
    db.$queryRaw<ProductCatalogueRow[]>`
      SELECT product_catalogues.id, product_catalogues.publish, product_catalogues.image, product_catalogues.level,
             product_catalogues.\`order\`, tb2.name, tb2.canonical
      ${from} ${cond}
      ORDER BY product_catalogues.lft ASC
      LIMIT ${perPage} OFFSET ${offset}`,
    db.$queryRaw<{ c: bigint }[]>`SELECT COUNT(*) AS c ${from} ${cond}`,
  ]);
  return { rows, total: Number(count[0].c), perPage, page };
}

export type ProductCatalogueDetail = {
  id: bigint;
  parent_id: number;
  lft: number;
  rgt: number;
  image: string | null;
  icon: string | null;
  album: string | null;
  publish: number;
  follow: number;
  attribute: string | null;
  short_name: string | null;
  name: string;
  description: string | null;
  content: string | null;
  meta_title: string | null;
  meta_keyword: string | null;
  meta_description: string | null;
  canonical: string;
};

/** ProductCatalogueRepository::getProductCatalogueById */
export async function getProductCatalogueById(id: bigint, languageId: bigint): Promise<ProductCatalogueDetail | null> {
  const rows = await db.$queryRaw<ProductCatalogueDetail[]>`
    SELECT product_catalogues.id, product_catalogues.parent_id, product_catalogues.lft, product_catalogues.rgt,
           product_catalogues.image, product_catalogues.icon, product_catalogues.album, product_catalogues.publish,
           product_catalogues.follow, product_catalogues.attribute, product_catalogues.short_name,
           tb2.name, tb2.description, tb2.content, tb2.meta_title, tb2.meta_keyword, tb2.meta_description, tb2.canonical
    FROM product_catalogues
    JOIN product_catalogue_language AS tb2 ON tb2.product_catalogue_id = product_catalogues.id
    WHERE product_catalogues.id = ${id} AND tb2.language_id = ${languageId} AND product_catalogues.deleted_at IS NULL
    LIMIT 1`;
  return rows[0] ?? null;
}

/** $request->only(payload()) + album: chi gan cot co trong request (giong Eloquent fill). */
function catalogueFields(input: Input) {
  const out: Record<string, unknown> = { album: formatAlbum(input) };
  const intOf = (k: string) => Number.parseInt(str(input, k, "0"), 10) || 0;
  for (const k of ["parent_id", "follow", "publish"]) if (input[k] !== undefined) out[k] = intOf(k);
  for (const k of ["image", "icon", "short_name"]) if (input[k] !== undefined) out[k] = nullable(input, k);
  return out;
}

function languageFields(input: Input) {
  return {
    name: str(input, "name"),
    description: nullable(input, "description"),
    content: nullable(input, "content"),
    meta_title: nullable(input, "meta_title"),
    meta_keyword: nullable(input, "meta_keyword"),
    meta_description: nullable(input, "meta_description"),
    canonical: slugify(str(input, "canonical")),
  };
}

async function saveTranslation(tx: Prisma.TransactionClient, id: bigint, input: Input, languageId: bigint) {
  const t = now();
  // $productCatalogue->languages()->detach([$languageId, $productCatalogue->id]) — giu nguyen hanh vi goc
  await tx.$executeRaw`DELETE FROM product_catalogue_language WHERE product_catalogue_id = ${id} AND language_id IN (${languageId}, ${id})`;
  const lang = languageFields(input);
  await tx.$executeRaw`
    INSERT INTO product_catalogue_language
      (product_catalogue_id, language_id, url, name, description, content, meta_title, meta_keyword, meta_description, canonical, created_at, updated_at)
    VALUES (${id}, ${languageId}, '', ${lang.name}, ${lang.description}, ${lang.content}, ${lang.meta_title}, ${lang.meta_keyword},
            ${lang.meta_description}, ${lang.canonical}, ${t}, ${t})`;
  return lang;
}

/** ProductCatalogueService::create */
export async function createProductCatalogue(input: Input, languageId: bigint, userId: bigint) {
  return db.$transaction(async (tx) => {
    const t = now();
    const catalogue = await tx.product_catalogues.create({
      // cot check NOT NULL khong default: Laravel (strict=false) ghi 0
      data: { check: 0, ...catalogueFields(input), user_id: userId, created_at: t, updated_at: t } as Prisma.product_cataloguesUncheckedCreateInput,
    });
    const lang = await saveTranslation(tx, catalogue.id, input, languageId);
    await saveRouter(tx, { canonical: lang.canonical, moduleId: catalogue.id, controller: CONTROLLERS.productCatalogue, languageId });
    await productCatalogueNested(languageId).rebuild(tx);
    return catalogue;
  });
}

/** ProductCatalogueService::update */
export async function updateProductCatalogue(id: bigint, input: Input, languageId: bigint) {
  await db.$transaction(async (tx) => {
    await tx.product_catalogues.update({
      where: { id },
      data: { ...catalogueFields(input), updated_at: now() } as Prisma.product_cataloguesUncheckedUpdateInput,
    });
    const lang = await saveTranslation(tx, id, input, languageId);
    await saveRouter(tx, { canonical: lang.canonical, moduleId: id, controller: CONTROLLERS.productCatalogue, languageId });
    await productCatalogueNested(languageId).rebuild(tx);
  });
}

/** ProductCatalogueService::destroy — xoa mem + xoa router + tinh lai cay */
export async function destroyProductCatalogue(id: bigint, languageId: bigint) {
  await db.$transaction(async (tx) => {
    await tx.product_catalogues.update({ where: { id }, data: { deleted_at: now() } });
    await tx.routers.deleteMany({ where: { module_id: id, controllers: CONTROLLERS.productCatalogue } });
    await productCatalogueNested(languageId).rebuild(tx);
  });
}

/** ProductCatalogue::isNodeCheck — con danh muc con thi khong xoa duoc */
export async function isProductCatalogueLeaf(id: bigint) {
  const c = await db.product_catalogues.findFirst({ where: { id, deleted_at: null }, select: { lft: true, rgt: true } });
  return !!c && c.rgt - c.lft === 1;
}

type AttrMap = Record<string, unknown[]>;

/** Mang PHP sau array_intersect giu key: key lien tuc 0..n-1 -> JSON array, nguoc lai -> object. */
function phpJsonList(values: [number, unknown][]) {
  const sequential = values.every(([k], i) => k === i);
  return sequential ? values.map(([, v]) => v) : Object.fromEntries(values.map(([k, v]) => [String(k), v]));
}

/**
 * ProductCatalogueService::setAttribute($product): gop thuoc tinh cua san pham vao
 * product_catalogues.attribute cua danh muc chinh.
 */
export async function setCatalogueAttribute(
  tx: Prisma.TransactionClient,
  product: { product_catalogue_id: number; attribute: AttrMap | null },
) {
  const attribute = product.attribute;
  if (attribute === null || attribute === undefined) return;
  const catalogueId = product.product_catalogue_id;
  const catalogue = await tx.product_catalogues.findFirst({ where: { id: BigInt(catalogueId), deleted_at: null } });
  if (!catalogue) throw new Error(`No query results for model [App\\Models\\ProductCatalogue] ${catalogueId}`);
  let current: unknown = null;
  try {
    current = catalogue.attribute ? JSON.parse(catalogue.attribute) : null;
  } catch {
    current = null;
  }
  let payload: unknown;
  if (current === null || typeof current !== "object") {
    payload = attribute;
  } else {
    // is_array($productCatalogue->attribute): JSON object/array deu la mang PHP
    const merge: Record<string, unknown[]> = {};
    for (const [k, v] of Object.entries(current as Record<string, unknown>)) {
      merge[k] = Array.isArray(v) ? v : v && typeof v === "object" ? Object.values(v) : [v];
    }
    for (const [key, val] of Object.entries(attribute)) {
      if (!(key in merge)) merge[key] = val;
      else {
        const seen = new Set<string>();
        merge[key] = [...merge[key], ...val].filter((x) => (seen.has(String(x)) ? false : (seen.add(String(x)), true)));
      }
    }
    const flat = Object.values(merge).flat().map(String);
    const list = flat.length
      ? (
          await tx.$queryRaw<{ id: bigint }[]>`
            SELECT DISTINCT attributes.id FROM attributes
            JOIN product_variant_attribute AS tb2 ON tb2.attribute_id = attributes.id
            JOIN product_variants AS tb3 ON tb3.id = tb2.product_variant_id
            JOIN product_catalogue_product AS tb4 ON tb4.product_id = tb3.product_id
            WHERE tb4.product_catalogue_id = ${catalogue.id} AND attributes.id IN (${Prisma.join(flat)})
              AND attributes.deleted_at IS NULL`
        ).map((r) => r.id.toString())
      : [];
    const allowed = new Set(list);
    payload = Object.fromEntries(
      Object.entries(merge).map(([k, arr]) => [
        k,
        phpJsonList(arr.map((v, i) => [i, v] as [number, unknown]).filter(([, v]) => allowed.has(String(v)))),
      ]),
    );
  }
  await tx.product_catalogues.update({
    where: { id: catalogue.id },
    data: { attribute: phpJsonEncode(phpArray(payload)), updated_at: now() },
  });
}

export type { Prisma };
