import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { now } from "@/lib/helpers";
import { str, type Input } from "@/lib/http";
import { slugify } from "@/lib/slug";
import { listParams, where, type SearchParams } from "@/server/admin-list";
import { nestedSet } from "@/server/nested-set";
import { saveRouter } from "@/server/router";
import { formatAlbum, mysqlInt, nullable } from "@/modules/product/payload";

/**
 * AttributeCatalogueRepository + AttributeCatalogueService (app/Services/V1/Attribute/AttributeCatalogueService.php).
 */

/** BaseService::formatRouterPayload: 'App\Http\Controllers\Frontend\\'.$controllerName */
export const ATTRIBUTE_CONTROLLERS = {
  attributeCatalogue: "App\\Http\\Controllers\\Frontend\\AttributeCatalogueController",
  attribute: "App\\Http\\Controllers\\Frontend\\AttributeController",
} as const;

export const attributeCatalogueNested = (languageId: bigint) =>
  nestedSet({ table: "attribute_catalogues", foreignKey: "attribute_catalogue_id", languageId });

export type AttributeCatalogueRow = {
  id: bigint;
  publish: number;
  image: string | null;
  level: number;
  order: number;
  name: string;
  canonical: string | null;
};

/** AttributeCatalogueService::paginate — sap xep lft ASC */
export async function paginateAttributeCatalogues(sp: SearchParams, languageId: bigint) {
  const { perPage, page, offset, keyword, publish } = listParams(sp);
  const cond = where([
    keyword ? Prisma.sql`tb2.name LIKE ${`%${keyword}%`}` : null,
    publish ? Prisma.sql`attribute_catalogues.publish = ${publish}` : null,
    Prisma.sql`tb2.language_id = ${languageId}`,
    Prisma.sql`attribute_catalogues.deleted_at IS NULL`,
  ]);
  const from = Prisma.sql`FROM attribute_catalogues JOIN attribute_catalogue_language AS tb2 ON tb2.attribute_catalogue_id = attribute_catalogues.id`;
  const [rows, count] = await Promise.all([
    db.$queryRaw<AttributeCatalogueRow[]>`
      SELECT attribute_catalogues.id, attribute_catalogues.publish, attribute_catalogues.image, attribute_catalogues.level,
             attribute_catalogues.\`order\`, tb2.name, tb2.canonical
      ${from} ${cond}
      ORDER BY attribute_catalogues.lft ASC
      LIMIT ${perPage} OFFSET ${offset}`,
    db.$queryRaw<{ c: bigint }[]>`SELECT COUNT(*) AS c ${from} ${cond}`,
  ]);
  return { rows, total: Number(count[0].c), perPage, page };
}

export type AttributeCatalogueDetail = {
  id: bigint;
  parent_id: number;
  image: string | null;
  icon: string | null;
  album: string | null;
  publish: number;
  follow: number;
  name: string;
  description: string | null;
  content: string | null;
  meta_title: string | null;
  meta_keyword: string | null;
  meta_description: string | null;
  canonical: string | null;
};

/** AttributeCatalogueRepository::getAttributeCatalogueById */
export async function getAttributeCatalogueById(id: bigint, languageId: bigint): Promise<AttributeCatalogueDetail | null> {
  const rows = await db.$queryRaw<AttributeCatalogueDetail[]>`
    SELECT attribute_catalogues.id, attribute_catalogues.parent_id, attribute_catalogues.image, attribute_catalogues.icon,
           attribute_catalogues.album, attribute_catalogues.publish, attribute_catalogues.follow,
           tb2.name, tb2.description, tb2.content, tb2.meta_title, tb2.meta_keyword, tb2.meta_description, tb2.canonical
    FROM attribute_catalogues
    JOIN attribute_catalogue_language AS tb2 ON tb2.attribute_catalogue_id = attribute_catalogues.id
    WHERE attribute_catalogues.id = ${id} AND tb2.language_id = ${languageId} AND attribute_catalogues.deleted_at IS NULL
    LIMIT 1`;
  return rows[0] ?? null;
}

/**
 * AttributeCatalogueRepository::getAll($languageId) + ->attribute_catalogue_language->first()->name.
 * Quan he attribute_catalogue_language trong model da loc cung language_id = 1.
 */
export async function getAllAttributeCatalogues(languageId: bigint) {
  const cats = await db.$queryRaw<{ id: bigint }[]>`SELECT id FROM attribute_catalogues WHERE deleted_at IS NULL`;
  if (!cats.length) return [];
  const names = await db.$queryRaw<{ id: bigint; name: string }[]>`
    SELECT attribute_catalogue_id AS id, name FROM attribute_catalogue_language
    WHERE language_id = 1 AND language_id = ${languageId} AND attribute_catalogue_id IN (${Prisma.join(cats.map((c) => c.id))})`;
  return cats.map((c) => ({ id: c.id, name: names.find((n) => n.id === c.id)?.name ?? null }));
}

/** $request->only(['parent_id','follow','publish','image','album']) */
function catalogueFields(input: Input) {
  const out: Record<string, unknown> = { album: formatAlbum(input) };
  for (const k of ["parent_id", "follow", "publish"]) if (input[k] !== undefined) out[k] = mysqlInt(input[k]);
  if (input.image !== undefined) out.image = nullable(input, "image");
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
  // $attributeCatalogue->languages()->detach([$languageId, $attributeCatalogue->id]) — giu nguyen hanh vi goc
  await tx.$executeRaw`DELETE FROM attribute_catalogue_language WHERE attribute_catalogue_id = ${id} AND language_id IN (${languageId}, ${id})`;
  const lang = languageFields(input);
  await tx.$executeRaw`
    INSERT INTO attribute_catalogue_language
      (attribute_catalogue_id, language_id, name, description, content, meta_title, meta_keyword, meta_description, canonical, created_at, updated_at)
    VALUES (${id}, ${languageId}, ${lang.name}, ${lang.description}, ${lang.content}, ${lang.meta_title}, ${lang.meta_keyword},
            ${lang.meta_description}, ${lang.canonical}, ${t}, ${t})`;
  return lang;
}

/** AttributeCatalogueService::create */
export async function createAttributeCatalogue(input: Input, languageId: bigint, userId: bigint) {
  return db.$transaction(async (tx) => {
    const t = now();
    const catalogue = await tx.attribute_catalogues.create({
      data: { ...catalogueFields(input), user_id: userId, created_at: t, updated_at: t } as Prisma.attribute_cataloguesUncheckedCreateInput,
    });
    const lang = await saveTranslation(tx, catalogue.id, input, languageId);
    await saveRouter(tx, { canonical: lang.canonical, moduleId: catalogue.id, controller: ATTRIBUTE_CONTROLLERS.attributeCatalogue, languageId });
    await attributeCatalogueNested(languageId).rebuild(tx);
    return catalogue;
  });
}

/** AttributeCatalogueService::update */
export async function updateAttributeCatalogue(id: bigint, input: Input, languageId: bigint) {
  await db.$transaction(async (tx) => {
    const exists = await tx.attribute_catalogues.findFirst({ where: { id, deleted_at: null }, select: { id: true } });
    if (!exists) throw new Error(`No query results for model [App\\Models\\AttributeCatalogue] ${id}`);
    await tx.attribute_catalogues.update({
      where: { id },
      data: { ...catalogueFields(input), updated_at: now() } as Prisma.attribute_cataloguesUncheckedUpdateInput,
    });
    const lang = await saveTranslation(tx, id, input, languageId);
    await saveRouter(tx, { canonical: lang.canonical, moduleId: id, controller: ATTRIBUTE_CONTROLLERS.attributeCatalogue, languageId });
    await attributeCatalogueNested(languageId).rebuild(tx);
  });
}

/** AttributeCatalogueService::destroy — xoa mem + tinh lai cay (ban goc KHONG xoa router) */
export async function destroyAttributeCatalogue(id: bigint, languageId: bigint) {
  await db.$transaction(async (tx) => {
    await tx.attribute_catalogues.update({ where: { id }, data: { deleted_at: now() } });
    await attributeCatalogueNested(languageId).rebuild(tx);
  });
}

/** AttributeCatalogue::isNodeCheck */
export async function isAttributeCatalogueLeaf(id: bigint) {
  const c = await db.attribute_catalogues.findFirst({ where: { id, deleted_at: null }, select: { lft: true, rgt: true } });
  return !!c && c.rgt - c.lft === 1;
}
