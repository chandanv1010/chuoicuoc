import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { now } from "@/lib/helpers";
import { arr, str, type Input } from "@/lib/http";
import { slugify } from "@/lib/slug";
import { intParam, listParams, where, type SearchParams } from "@/server/admin-list";
import { saveRouter } from "@/server/router";
import { formatAlbum, mysqlInt, nullable } from "@/modules/product/payload";
import { ATTRIBUTE_CONTROLLERS } from "./attribute-catalogue";

/** AttributeRepository + AttributeService (app/Services/V1/Attribute/AttributeService.php). */

export type AttributeRow = {
  id: bigint;
  publish: number;
  image: string | null;
  order: number;
  name: string;
  canonical: string | null;
};

/** AttributeService::paginate — join attribute_catalogue_attribute, loc danh muc gom ca con, id DESC */
export async function paginateAttributes(sp: SearchParams, languageId: bigint) {
  const { perPage, page, offset, keyword, publish } = listParams(sp);
  const catId = intParam(sp, "attribute_catalogue_id");
  const cond = where([
    keyword ? Prisma.sql`tb2.name LIKE ${`%${keyword}%`}` : null,
    publish ? Prisma.sql`attributes.publish = ${publish}` : null,
    Prisma.sql`tb2.language_id = ${languageId}`,
    catId > 0
      ? Prisma.sql`tb3.attribute_catalogue_id IN (
          SELECT id FROM attribute_catalogues
          JOIN attribute_catalogue_language ON attribute_catalogues.id = attribute_catalogue_language.attribute_catalogue_id
          WHERE lft >= (SELECT lft FROM attribute_catalogues AS pc WHERE pc.id = ${catId})
            AND rgt <= (SELECT rgt FROM attribute_catalogues AS pc WHERE pc.id = ${catId})
            AND attribute_catalogue_language.language_id = ${languageId})`
      : null,
    Prisma.sql`attributes.deleted_at IS NULL`,
  ]);
  const from = Prisma.sql`FROM attributes
    JOIN attribute_language AS tb2 ON tb2.attribute_id = attributes.id
    JOIN attribute_catalogue_attribute AS tb3 ON attributes.id = tb3.attribute_id`;
  const [rows, count] = await Promise.all([
    db.$queryRaw<AttributeRow[]>`
      SELECT attributes.id, attributes.publish, attributes.image, attributes.\`order\`, tb2.name, tb2.canonical
      ${from} ${cond}
      GROUP BY attributes.id, attributes.publish, attributes.image, attributes.\`order\`, tb2.name, tb2.canonical
      ORDER BY attributes.id DESC
      LIMIT ${perPage} OFFSET ${offset}`,
    db.$queryRaw<{ c: bigint }[]>`SELECT COUNT(DISTINCT attributes.id) AS c ${from} ${cond}`,
  ]);
  return { rows, total: Number(count[0].c), perPage, page };
}

/** $attribute->attribute_catalogues + attribute_catalogue_language (quan he loc language_id = 1). */
export async function catalogueNamesOfAttributes(ids: bigint[]) {
  const map = new Map<string, { id: bigint; names: string[] }[]>();
  if (!ids.length) return map;
  const rows = await db.$queryRaw<{ attribute_id: bigint; id: bigint; name: string | null }[]>`
    SELECT aca.attribute_id, ac.id, acl.name
    FROM attribute_catalogue_attribute aca
    JOIN attribute_catalogues ac ON ac.id = aca.attribute_catalogue_id AND ac.deleted_at IS NULL
    LEFT JOIN attribute_catalogue_language acl ON acl.attribute_catalogue_id = ac.id AND acl.language_id = 1
    WHERE aca.attribute_id IN (${Prisma.join(ids)})`;
  for (const r of rows) {
    const key = r.attribute_id.toString();
    const list = map.get(key) ?? [];
    let cat = list.find((c) => c.id === r.id);
    if (!cat) list.push((cat = { id: r.id, names: [] }));
    if (r.name !== null) cat.names.push(r.name);
    map.set(key, list);
  }
  return map;
}

/** AttributeRepository::getAttributeById (kem id danh muc phu) */
export async function getAttributeById(id: bigint, languageId: bigint) {
  const rows = await db.$queryRaw<
    {
      id: bigint;
      attribute_catalogue_id: number;
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
    }[]
  >`
    SELECT attributes.id, attributes.attribute_catalogue_id, attributes.image, attributes.icon, attributes.album,
           attributes.publish, attributes.follow, tb2.name, tb2.description, tb2.content, tb2.meta_title,
           tb2.meta_keyword, tb2.meta_description, tb2.canonical
    FROM attributes JOIN attribute_language AS tb2 ON tb2.attribute_id = attributes.id
    WHERE attributes.id = ${id} AND tb2.language_id = ${languageId} AND attributes.deleted_at IS NULL
    LIMIT 1`;
  const attribute = rows[0];
  if (!attribute) return null;
  const cats = await db.$queryRaw<{ id: bigint }[]>`
    SELECT ac.id FROM attribute_catalogue_attribute aca JOIN attribute_catalogues ac ON ac.id = aca.attribute_catalogue_id
    WHERE aca.attribute_id = ${id} AND ac.deleted_at IS NULL`;
  return { ...attribute, catalogueIds: cats.map((c) => c.id.toString()) };
}

function attributeFields(input: Input) {
  const out: Record<string, unknown> = { album: formatAlbum(input) };
  for (const k of ["follow", "publish", "attribute_catalogue_id"]) if (input[k] !== undefined) out[k] = mysqlInt(input[k]);
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
  // $attribute->languages()->detach([$languageId, $attribute->id]) — giu nguyen hanh vi goc
  await tx.$executeRaw`DELETE FROM attribute_language WHERE attribute_id = ${id} AND language_id IN (${languageId}, ${id})`;
  const lang = languageFields(input);
  await tx.$executeRaw`
    INSERT INTO attribute_language
      (attribute_id, language_id, name, description, content, meta_title, meta_keyword, meta_description, canonical, created_at, updated_at)
    VALUES (${id}, ${languageId}, ${lang.name}, ${lang.description}, ${lang.content}, ${lang.meta_title}, ${lang.meta_keyword},
            ${lang.meta_description}, ${lang.canonical}, ${t}, ${t})`;
  return lang;
}

/** AttributeService::catalogue(): catalogue[] + attribute_catalogue_id, array_unique */
function catalogueIds(input: Input) {
  const main = input.attribute_catalogue_id === null || input.attribute_catalogue_id === undefined ? "" : str(input, "attribute_catalogue_id");
  return [...new Set([...arr(input, "catalogue"), main])].filter((x) => /^\d+$/.test(x));
}

/** $attribute->attribute_catalogues()->sync(...) */
async function syncCatalogues(tx: Prisma.TransactionClient, attributeId: bigint, ids: string[]) {
  const current = (
    await tx.$queryRaw<{ id: bigint }[]>`SELECT attribute_catalogue_id AS id FROM attribute_catalogue_attribute WHERE attribute_id = ${attributeId}`
  ).map((r) => r.id.toString());
  const detach = current.filter((c) => !ids.includes(c));
  if (detach.length) {
    await tx.$executeRaw`DELETE FROM attribute_catalogue_attribute WHERE attribute_id = ${attributeId} AND attribute_catalogue_id IN (${Prisma.join(detach)})`;
  }
  for (const cid of ids) {
    if (!current.includes(cid)) {
      await tx.$executeRaw`INSERT INTO attribute_catalogue_attribute (attribute_catalogue_id, attribute_id) VALUES (${cid}, ${attributeId})`;
    }
  }
}

/** AttributeService::create */
export async function createAttribute(input: Input, languageId: bigint, userId: bigint) {
  return db.$transaction(async (tx) => {
    const t = now();
    const attribute = await tx.attributes.create({
      data: { ...attributeFields(input), user_id: userId, created_at: t, updated_at: t } as Prisma.attributesUncheckedCreateInput,
    });
    const lang = await saveTranslation(tx, attribute.id, input, languageId);
    await syncCatalogues(tx, attribute.id, catalogueIds(input));
    await saveRouter(tx, { canonical: lang.canonical, moduleId: attribute.id, controller: ATTRIBUTE_CONTROLLERS.attribute, languageId });
    return attribute;
  });
}

/** AttributeService::update */
export async function updateAttribute(id: bigint, input: Input, languageId: bigint) {
  await db.$transaction(async (tx) => {
    const exists = await tx.attributes.findFirst({ where: { id, deleted_at: null }, select: { id: true } });
    if (!exists) throw new Error(`No query results for model [App\\Models\\Attribute] ${id}`);
    await tx.attributes.update({ where: { id }, data: { ...attributeFields(input), updated_at: now() } as Prisma.attributesUncheckedUpdateInput });
    const lang = await saveTranslation(tx, id, input, languageId);
    await syncCatalogues(tx, id, catalogueIds(input));
    await saveRouter(tx, { canonical: lang.canonical, moduleId: id, controller: ATTRIBUTE_CONTROLLERS.attribute, languageId });
  });
}

/** AttributeService::destroy — chi xoa mem (ban goc khong xoa router) */
export async function destroyAttribute(id: bigint) {
  await db.attributes.update({ where: { id }, data: { deleted_at: now() } });
}

/** AttributeRepository::searchAttributes — dung cho ajax/attribute/getAttribute */
export async function searchAttributes(keyword: string, attributeCatalogueId: string) {
  const rows = await db.$queryRaw<{ id: bigint }[]>`
    SELECT attributes.id FROM attributes
    WHERE attributes.deleted_at IS NULL
      AND EXISTS (SELECT 1 FROM attribute_catalogues ac
                  JOIN attribute_catalogue_attribute aca ON ac.id = aca.attribute_catalogue_id
                  WHERE attributes.id = aca.attribute_id AND aca.attribute_catalogue_id = ${attributeCatalogueId}
                    AND ac.deleted_at IS NULL)
      AND EXISTS (SELECT 1 FROM attribute_language al WHERE attributes.id = al.attribute_id AND al.name LIKE ${`%${keyword}%`})`;
  if (!rows.length) return [];
  // $attribute->attribute_language->first()->name (khong loc ngon ngu)
  const names = await db.$queryRaw<{ attribute_id: bigint; name: string }[]>`
    SELECT attribute_id, name FROM attribute_language WHERE attribute_id IN (${Prisma.join(rows.map((r) => r.id))})`;
  return rows.map((r) => ({ id: Number(r.id), text: names.find((n) => n.attribute_id === r.id)?.name ?? null }));
}

/** AttributeRepository::findAttributeByIdArray — publish = 2, ban dich theo ngon ngu */
export async function findAttributeByIdArray(ids: unknown[], languageId: bigint) {
  const list = ids.map((x) => String(x));
  if (!list.length) return [];
  return db.$queryRaw<{ id: bigint; attribute_catalogue_id: number; image: string | null; name: string }[]>`
    SELECT attributes.id, attributes.attribute_catalogue_id, attributes.image, tb2.name
    FROM attributes JOIN attribute_language AS tb2 ON tb2.attribute_id = attributes.id
    WHERE tb2.language_id = ${languageId} AND publish = 2 AND attributes.id IN (${Prisma.join(list)})
      AND attributes.deleted_at IS NULL`;
}
