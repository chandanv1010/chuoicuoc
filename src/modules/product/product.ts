import "server-only";
import { Prisma } from "@prisma/client";
import { CONTROLLERS } from "@/lib/constants";
import { db } from "@/lib/db";
import { now, writeUrl } from "@/lib/helpers";
import { moneyNumber, parseMoneyOrZero } from "@/lib/money";
import { arr, str, type Input } from "@/lib/http";
import { slugify } from "@/lib/slug";
import { intParam, param, where, type SearchParams } from "@/server/admin-list";
import { saveRouter } from "@/server/router";
import { formatAlbum, formatJson, mysqlInt, nullable, phpArray, phpJsonEncode } from "./payload";
import { setCatalogueAttribute } from "./product-catalogue";
import { qrSvg } from "./qrcode";
import { NAMESPACE_DNS, uuid5 } from "./uuid";

/**
 * ProductRepository + ProductService (app/Services/V1/Product/ProductService.php) — phan admin.
 */

export type ProductRow = {
  id: bigint;
  publish: number;
  image: string | null;
  order: number;
  price: number;
  stock: number;
  name: string;
  canonical: string | null;
};

/**
 * ProductService::paginate (admin): 8 dong/trang co dinh (dung chung voi luoi san pham ngoai site),
 * loc product_catalogue_id gom ca danh muc con, sap xep theo ?sort (mac dinh products.id DESC).
 */
export async function paginateProducts(sp: SearchParams, languageId: bigint) {
  const perPage = 8;
  const page = Math.max(1, intParam(sp, "page") || 1);
  const keyword = (param(sp, "keyword") ?? "").trim();
  const publish = intParam(sp, "publish");
  const catId = intParam(sp, "product_catalogue_id");
  const sort = param(sp, "sort") ?? "newest";
  const orderBy =
    sort === "oldest"
      ? Prisma.sql`products.id ASC`
      : sort === "price_desc"
        ? Prisma.sql`products.price DESC`
        : sort === "price_asc"
          ? Prisma.sql`products.price ASC`
          : Prisma.sql`products.id DESC`;
  const cond = where([
    keyword ? Prisma.sql`tb2.name LIKE ${`%${keyword}%`}` : null,
    publish ? Prisma.sql`products.publish = ${publish}` : null,
    Prisma.sql`tb2.language_id = ${languageId}`,
    catId > 0
      ? Prisma.sql`tb3.product_catalogue_id IN (
          SELECT id FROM product_catalogues
          JOIN product_catalogue_language ON product_catalogues.id = product_catalogue_language.product_catalogue_id
          WHERE lft >= (SELECT lft FROM product_catalogues AS pc WHERE pc.id = ${catId})
            AND rgt <= (SELECT rgt FROM product_catalogues AS pc WHERE pc.id = ${catId})
            AND product_catalogue_language.language_id = ${languageId})`
      : null,
    Prisma.sql`products.deleted_at IS NULL`,
  ]);
  const from = Prisma.sql`FROM products
    JOIN product_language AS tb2 ON tb2.product_id = products.id
    JOIN product_catalogue_product AS tb3 ON products.id = tb3.product_id`;
  const [rows, count] = await Promise.all([
    db.$queryRaw<ProductRow[]>`
      SELECT products.id, products.publish, products.image, products.\`order\`, products.price, products.stock,
             tb2.name, tb2.canonical
      ${from} ${cond}
      GROUP BY products.id, products.publish, products.image, products.\`order\`, products.price, products.stock,
               tb2.name, tb2.canonical
      ORDER BY ${orderBy}
      LIMIT ${perPage} OFFSET ${(page - 1) * perPage}`,
    db.$queryRaw<{ c: bigint }[]>`SELECT COUNT(DISTINCT products.id) AS c ${from} ${cond}`,
  ]);
  return { rows: rows.map((r) => ({ ...r, price: moneyNumber(r.price) })), total: Number(count[0].c), perPage, page };
}

/**
 * $product->product_catalogues + product_catalogue_language (quan he Eloquent loc cung language_id = 1)
 * cho cot "Nhom hien thi".
 */
export async function catalogueNamesOfProducts(ids: bigint[]) {
  const map = new Map<string, { id: bigint; names: string[] }[]>();
  if (!ids.length) return map;
  const rows = await db.$queryRaw<{ product_id: bigint; id: bigint; name: string | null }[]>`
    SELECT pcp.product_id, pc.id, pcl.name
    FROM product_catalogue_product pcp
    JOIN product_catalogues pc ON pc.id = pcp.product_catalogue_id AND pc.deleted_at IS NULL
    LEFT JOIN product_catalogue_language pcl ON pcl.product_catalogue_id = pc.id AND pcl.language_id = 1
    WHERE pcp.product_id IN (${Prisma.join(ids)})`;
  for (const r of rows) {
    const key = r.product_id.toString();
    const list = map.get(key) ?? [];
    let cat = list.find((c) => c.id === r.id);
    if (!cat) list.push((cat = { id: r.id, names: [] }));
    if (r.name !== null) cat.names.push(r.name);
    map.set(key, list);
  }
  return map;
}

/** write_url($product->languages->first()->pivot->canonical): ban dich dau tien cua san pham. */
export async function firstLanguageUrls(ids: bigint[]) {
  const map = new Map<string, string>();
  if (!ids.length) return map;
  const rows = await db.$queryRaw<{ product_id: bigint; canonical: string | null }[]>`
    SELECT pl.product_id, pl.canonical FROM product_language pl
    JOIN languages l ON l.id = pl.language_id
    WHERE pl.product_id IN (${Prisma.join(ids)})`;
  for (const r of rows) {
    const key = r.product_id.toString();
    if (!map.has(key)) map.set(key, writeUrl(r.canonical));
  }
  return map;
}

export type ProductDetail = {
  id: bigint;
  product_catalogue_id: number;
  image: string | null;
  icon: string | null;
  album: string | null;
  publish: number;
  follow: number;
  /** DECIMAL(12,2) -> number 2 chu so (getProductById doi) */
  price: number;
  combo_price: number | null;
  code: string;
  made_in: string | null;
  attributeCatalogue: string | null;
  attribute: string | null;
  variant: string | null;
  qrcode: string | null;
  warranty: number | null;
  iframe: string | null;
  specification: string | null;
  seller_id: bigint | null;
  ml: string | null;
  percent: string | null;
  stock: number;
  no_offer: number;
  promotion_content: string | null;
  name: string;
  description: string | null;
  content: string | null;
  meta_title: string | null;
  meta_keyword: string | null;
  meta_description: string | null;
  canonical: string;
};

/**
 * ProductRepository::getProductById. Da sua so voi ban goc: lay them stock, no_offer, promotion_content
 * (ban goc khong lay nen form sua hien 0 / rong va luu lai la mat ton kho).
 */
export async function getProductById(id: bigint, languageId: bigint) {
  const rows = await db.$queryRaw<ProductDetail[]>`
    SELECT products.id, products.product_catalogue_id, products.image, products.icon, products.album, products.publish,
           products.follow, products.price, products.combo_price, products.code, products.made_in,
           products.attributeCatalogue, products.attribute, products.variant, products.qrcode, products.warranty,
           products.iframe, products.specification, products.seller_id, products.ml, products.percent,
           products.stock, products.no_offer, products.promotion_content,
           tb2.name, tb2.description, tb2.content, tb2.meta_title, tb2.meta_keyword, tb2.meta_description, tb2.canonical
    FROM products JOIN product_language AS tb2 ON tb2.product_id = products.id
    WHERE products.id = ${id} AND tb2.language_id = ${languageId} AND products.deleted_at IS NULL
    LIMIT 1`;
  const product = rows[0];
  if (!product) return null;
  product.price = moneyNumber(product.price);
  product.combo_price = product.combo_price === null ? null : moneyNumber(product.combo_price);
  const [cats, variants] = await Promise.all([
    db.$queryRaw<{ id: bigint }[]>`
      SELECT pc.id FROM product_catalogue_product pcp JOIN product_catalogues pc ON pc.id = pcp.product_catalogue_id
      WHERE pcp.product_id = ${id} AND pc.deleted_at IS NULL`,
    db.product_variants.count({ where: { product_id: id } }),
  ]);
  return { ...product, catalogueIds: cats.map((c) => c.id.toString()), variantCount: variants };
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

/** Cot cua products co trong $request->only(payload()) va trong $fillable cua model Product. */
function commonFields(input: Input) {
  const out: Record<string, unknown> = {};
  const has = (k: string) => input[k] !== undefined;
  for (const k of ["follow", "publish", "product_catalogue_id", "total_lesson"]) if (has(k)) out[k] = mysqlInt(input[k]);
  if (has("warranty")) out.warranty = input.warranty === null ? null : mysqlInt(input.warranty);
  for (const k of ["image", "made_in", "iframe", "specification", "ml", "percent", "lession_content"]) if (has(k)) out[k] = nullable(input, k);
  if (has("code")) out.code = input.code === null ? null : str(input, "code");
  if (has("duration")) out.duration = str(input, "duration");
  if (has("chapter")) out.chapter = input.chapter === null ? null : phpJsonEncode(phpArray(input.chapter));
  return out;
}

/** attribute (cast json tren model): mang tu request -> json_encode, khong co -> null. */
function attributeOf(input: Input): Record<string, string[]> | null {
  const v = input.attribute;
  if (v === undefined || v === null) return null;
  return phpArray(v) as Record<string, string[]>;
}

/** ProductService::qrCode: QR cua write_url(canonical) */
function qrCode(input: Input) {
  return qrSvg(writeUrl(str(input, "canonical")));
}

async function saveTranslation(tx: Prisma.TransactionClient, productId: bigint, input: Input, languageId: bigint) {
  const t = now();
  // $product->languages()->detach([$languageId, $product->id]) — giu nguyen hanh vi goc
  await tx.$executeRaw`DELETE FROM product_language WHERE product_id = ${productId} AND language_id IN (${languageId}, ${productId})`;
  const lang = languageFields(input);
  await tx.$executeRaw`
    INSERT INTO product_language
      (product_id, language_id, url, name, description, content, meta_title, meta_keyword, meta_description, canonical, created_at, updated_at)
    VALUES (${productId}, ${languageId}, '', ${lang.name}, ${lang.description}, ${lang.content}, ${lang.meta_title},
            ${lang.meta_keyword}, ${lang.meta_description}, ${lang.canonical}, ${t}, ${t})`;
  return lang;
}

/** ProductService::catalogue(): catalogue[] + product_catalogue_id, array_unique. */
function catalogueIds(input: Input) {
  const main = input.product_catalogue_id === null || input.product_catalogue_id === undefined ? "" : str(input, "product_catalogue_id");
  return [...new Set([...arr(input, "catalogue"), main])].filter((x) => /^\d+$/.test(x));
}

/** $product->product_catalogues()->sync(...) */
async function syncCatalogues(tx: Prisma.TransactionClient, productId: bigint, ids: string[]) {
  const current = (await tx.$queryRaw<{ id: bigint }[]>`
    SELECT product_catalogue_id AS id FROM product_catalogue_product WHERE product_id = ${productId}`).map((r) => r.id.toString());
  const detach = current.filter((c) => !ids.includes(c));
  if (detach.length) {
    await tx.$executeRaw`DELETE FROM product_catalogue_product WHERE product_id = ${productId} AND product_catalogue_id IN (${Prisma.join(detach)})`;
  }
  for (const cid of ids) {
    if (!current.includes(cid)) {
      await tx.$executeRaw`INSERT INTO product_catalogue_product (product_catalogue_id, product_id) VALUES (${cid}, ${productId})`;
    }
  }
}

/** sortString(): tach dau phay, trim, sort SORT_NUMERIC, noi lai. */
function sortString(s: string) {
  return s
    .split(",")
    .map((x) => x.trim())
    .sort((a, b) => (Number.parseFloat(a) || 0) - (Number.parseFloat(b) || 0))
    .join(",");
}

/** comebineAttribute(): tich Descartes cac nhom gia tri thuoc tinh. */
function combineAttribute(attributes: unknown[][], index = 0): unknown[][] {
  if (index === attributes.length) return [[]];
  const sub = combineAttribute(attributes, index + 1);
  const out: unknown[][] = [];
  for (const val of attributes[index]) for (const s of sub) out.push([val, ...s]);
  return out;
}

/** Gia tri "true" theo PHP (if ($x)). */
function phpTruthy(v: unknown) {
  if (v === null || v === undefined || v === false || v === "" || v === "0" || v === 0) return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "object") return Object.keys(v as object).length > 0;
  return true;
}

const listOf = (v: unknown): unknown[] => (Array.isArray(v) ? v : v && typeof v === "object" ? Object.values(v) : []);
const at = (group: unknown, key: string, i: number) => {
  const g = (group ?? {}) as Record<string, unknown>;
  return listOf(g[key])[i];
};

/** ProductService::createVariant (+ createVariantArray) */
async function createVariant(tx: Prisma.TransactionClient, productId: bigint, input: Input, languageId: bigint, userId: bigint) {
  const variant = input.variant;
  const productVariant = input.productVariant;
  const skus = listOf((variant as Record<string, unknown> | undefined)?.sku);
  const t = now();
  const ids: bigint[] = [];
  for (let i = 0; i < skus.length; i++) {
    const vId = at(productVariant, "id", i);
    const vIdStr = vId === null || vId === undefined ? "" : String(vId);
    const price = at(variant, "price", i);
    const row = {
      product_id: productId,
      uuid: uuid5(NAMESPACE_DNS, `${productId}, ${vIdStr}`),
      code: sortString(vIdStr),
      quantity: mysqlInt(at(variant, "quantity", i) ?? ""),
      sku: skus[i] === null || skus[i] === undefined ? null : String(skus[i]),
      // USD co xu: "26.50", "1,234.50", "$26.50" -> "26.50" (ban VND: convert_price + int)
      price: phpTruthy(price) ? parseMoneyOrZero(price) : "0.00",
      barcode: String(at(variant, "barcode", i) ?? ""),
      file_name: String(at(variant, "file_name", i) ?? ""),
      file_url: String(at(variant, "file_url", i) ?? ""),
      album: String(at(variant, "album", i) ?? ""),
      user_id: userId,
      created_at: t,
      updated_at: t,
    };
    const created = await tx.product_variants.create({ data: row });
    ids.push(created.id);
  }
  const combines = combineAttribute(Object.values((input.attribute ?? {}) as Record<string, unknown>).map(listOf));
  for (let i = 0; i < ids.length; i++) {
    const name = at(productVariant, "name", i);
    if (name === null || name === undefined) throw new Error("Column 'name' cannot be null");
    await tx.$executeRaw`INSERT INTO product_variant_language (product_variant_id, language_id, name) VALUES (${ids[i]}, ${languageId}, ${String(name)})`;
  }
  if (combines.length) {
    for (let i = 0; i < ids.length; i++) {
      // $attributeCombines[$key] khong ton tai -> PHP warning -> ErrorException (giu nguyen: loi)
      if (!combines[i]) throw new Error(`Undefined array key ${i}`);
      for (const attributeId of combines[i]) {
        await tx.$executeRaw`INSERT INTO product_variant_attribute (product_variant_id, attribute_id) VALUES (${ids[i]}, ${String(attributeId)})`;
      }
    }
  }
}

/** $product->product_variants()->each(...): xoa ban dich, thuoc tinh va xoa cung bien the. */
async function deleteVariants(tx: Prisma.TransactionClient, productId: bigint) {
  const variants = await tx.product_variants.findMany({ where: { product_id: productId }, select: { id: true } });
  for (const v of variants) {
    await tx.$executeRaw`DELETE FROM product_variant_language WHERE product_variant_id = ${v.id}`;
    await tx.$executeRaw`DELETE FROM product_variant_attribute WHERE product_variant_id = ${v.id}`;
    await tx.product_variants.delete({ where: { id: v.id } });
  }
}

/**
 * Ban goc uploadProduct() dua thang mang attributeCatalogue[] / variant[...] cua request vao
 * Eloquent -> PDO bind mang -> "Array to string conversion" -> ErrorException -> echo/die.
 * Tuc la sua san pham co bien the luon that bai. Giu nguyen hanh vi (tra flash error);
 * dat false de cho phep cap nhat (khi do attributeCatalogue/variant duoc json_encode nhu luc tao).
 */
// Da sua: cho phep cap nhat san pham co bien the (ban Laravel luon loi o day).
export const KEEP_LARAVEL_UPDATE_ARRAY_BUG = false;

/** ProductService::create */
export async function createProduct(input: Input, languageId: bigint, userId: bigint) {
  return db.$transaction(async (tx) => {
    const t = now();
    const attribute = attributeOf(input);
    const data = {
      // cot NOT NULL khong default (check, total_lesson, duration): Laravel strict=false ghi 0 / ''
      check: 0,
      total_lesson: 0,
      duration: "",
      ...commonFields(input),
      stock: Math.max(0, mysqlInt(input.stock ?? 0)),
      // Ban goc khong co no_offer / promotion_content trong $fillable nen khong bao gio luu; da sua
      no_offer: String(input.no_offer ?? "") === "1" ? 1 : 0,
      promotion_content: input.promotion_content === undefined || input.promotion_content === null ? null : String(input.promotion_content),
      user_id: userId,
      album: formatAlbum(input),
      price: parseMoneyOrZero(input.price),
      combo_price: parseMoneyOrZero(input.combo_price),
      attributeCatalogue: formatJson(input, "attributeCatalogue"),
      attribute: attribute === null ? null : phpJsonEncode(attribute),
      variant: formatJson(input, "variant"),
      qrcode: qrCode(input),
      created_at: t,
      updated_at: t,
    };
    const product = await tx.products.create({ data: data as Prisma.productsUncheckedCreateInput });
    const lang = await saveTranslation(tx, product.id, input, languageId);
    await syncCatalogues(tx, product.id, catalogueIds(input));
    await saveRouter(tx, { canonical: lang.canonical, moduleId: product.id, controller: CONTROLLERS.product, languageId });
    if (phpTruthy(input.attribute)) await createVariant(tx, product.id, input, languageId, userId);
    await setCatalogueAttribute(tx, { product_catalogue_id: product.product_catalogue_id, attribute });
    return product;
  });
}

/** ProductService::update (uploadProduct + xoa/tao lai bien the) */
export async function updateProduct(id: bigint, input: Input, languageId: bigint, userId: bigint) {
  const isArray = (v: unknown) => v !== null && typeof v === "object";
  if (KEEP_LARAVEL_UPDATE_ARRAY_BUG && (isArray(input.attributeCatalogue) || isArray(input.variant))) {
    throw new Error("Array to string conversion");
  }
  await db.$transaction(async (tx) => {
    const exists = await tx.products.findFirst({ where: { id, deleted_at: null }, select: { id: true } });
    if (!exists) throw new Error(`No query results for model [App\\Models\\Product] ${id}`);
    const attribute = attributeOf(input);
    const data: Record<string, unknown> = {
      ...commonFields(input),
      stock: Math.max(0, mysqlInt(input.stock ?? 0)),
      // Ban goc khong co no_offer / promotion_content trong $fillable nen khong bao gio luu; da sua
      no_offer: String(input.no_offer ?? "") === "1" ? 1 : 0,
      promotion_content: input.promotion_content === undefined || input.promotion_content === null ? null : String(input.promotion_content),
      album: formatAlbum(input),
      price: parseMoneyOrZero(input.price),
      combo_price: parseMoneyOrZero(input.combo_price),
      attribute: attribute === null ? null : phpJsonEncode(attribute),
      qrcode: qrCode(input),
      updated_at: now(),
    };
    if (input.attributeCatalogue !== undefined) data.attributeCatalogue = formatJson(input, "attributeCatalogue");
    if (input.variant !== undefined) data.variant = formatJson(input, "variant");
    const product = await tx.products.update({ where: { id }, data: data as Prisma.productsUncheckedUpdateInput });
    const lang = await saveTranslation(tx, id, input, languageId);
    await syncCatalogues(tx, id, catalogueIds(input));
    await saveRouter(tx, { canonical: lang.canonical, moduleId: id, controller: CONTROLLERS.product, languageId });
    await deleteVariants(tx, id);
    if (phpTruthy(input.attribute)) await createVariant(tx, id, input, languageId, userId);
    await setCatalogueAttribute(tx, { product_catalogue_id: product.product_catalogue_id, attribute });
  });
}

/** ProductService::destroy — xoa mem + xoa router (bien the giu nguyen) */
export async function destroyProduct(id: bigint) {
  await db.$transaction(async (tx) => {
    await tx.products.update({ where: { id }, data: { deleted_at: now() } });
    await tx.routers.deleteMany({ where: { module_id: id, controllers: CONTROLLERS.product } });
  });
}
