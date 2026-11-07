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

/**
 * PostCatalogueRepository + PostCatalogueService (app/Services/V1/Post/PostCatalogueService.php).
 */
export const postCatalogueNested = (languageId: bigint) =>
  nestedSet({ table: "post_catalogues", foreignKey: "post_catalogue_id", languageId });

export type PostCatalogueRow = {
  id: bigint;
  publish: number;
  image: string | null;
  level: number;
  order: number;
  name: string;
  canonical: string;
};

/** PostCatalogueService::paginate — join post_catalogue_language, sap xep lft ASC. */
export async function paginatePostCatalogues(sp: SearchParams, languageId: bigint) {
  const { perPage, page, offset, keyword, publish } = listParams(sp);
  const cond = where([
    keyword ? Prisma.sql`tb2.name LIKE ${`%${keyword}%`}` : null,
    publish ? Prisma.sql`post_catalogues.publish = ${publish}` : null,
    Prisma.sql`tb2.language_id = ${languageId}`,
    Prisma.sql`post_catalogues.deleted_at IS NULL`,
  ]);
  const from = Prisma.sql`FROM post_catalogues JOIN post_catalogue_language AS tb2 ON tb2.post_catalogue_id = post_catalogues.id`;
  const [rows, count] = await Promise.all([
    db.$queryRaw<PostCatalogueRow[]>`
      SELECT post_catalogues.id, post_catalogues.publish, post_catalogues.image, post_catalogues.level,
             post_catalogues.\`order\`, tb2.name, tb2.canonical
      ${from} ${cond}
      ORDER BY post_catalogues.lft ASC
      LIMIT ${perPage} OFFSET ${offset}`,
    db.$queryRaw<{ c: bigint }[]>`SELECT COUNT(*) AS c ${from} ${cond}`,
  ]);
  return { rows, total: Number(count[0].c), perPage, page };
}

export type PostCatalogueDetail = {
  id: bigint;
  parent_id: number;
  image: string | null;
  icon: string | null;
  album: string | null;
  publish: number;
  follow: number;
  lft: number;
  rgt: number;
  short_name: string | null;
  name: string;
  description: string | null;
  content: string | null;
  meta_title: string | null;
  meta_keyword: string | null;
  meta_description: string | null;
  canonical: string;
};

/** PostCatalogueRepository::getPostCatalogueById */
export async function getPostCatalogueById(id: bigint, languageId: bigint): Promise<PostCatalogueDetail | null> {
  const rows = await db.$queryRaw<PostCatalogueDetail[]>`
    SELECT post_catalogues.id, post_catalogues.parent_id, post_catalogues.image, post_catalogues.icon,
           post_catalogues.album, post_catalogues.publish, post_catalogues.follow, post_catalogues.lft,
           post_catalogues.rgt, post_catalogues.short_name, tb2.name, tb2.description, tb2.content,
           tb2.meta_title, tb2.meta_keyword, tb2.meta_description, tb2.canonical
    FROM post_catalogues
    JOIN post_catalogue_language AS tb2 ON tb2.post_catalogue_id = post_catalogues.id
    WHERE post_catalogues.id = ${id} AND tb2.language_id = ${languageId} AND post_catalogues.deleted_at IS NULL
    LIMIT 1`;
  return rows[0] ?? null;
}

/** BaseService::formatAlbum: co album thi json_encode, khong thi chuoi rong. */
export function formatAlbum(input: Input): string {
  const album = input.album;
  if (Array.isArray(album) && album.length) return JSON.stringify(album);
  if (album && typeof album === "object" && Object.keys(album).length) return JSON.stringify(Object.values(album));
  return "";
}

function catalogueFields(input: Input) {
  return {
    parent_id: Number.parseInt(str(input, "parent_id", "0"), 10) || 0,
    follow: Number.parseInt(str(input, "follow", "0"), 10) || 0,
    publish: Number.parseInt(str(input, "publish", "0"), 10) || 0,
    image: str(input, "image") || null,
    album: formatAlbum(input),
    short_name: input.short_name === undefined ? undefined : str(input, "short_name") || null,
  };
}

function languageFields(input: Input) {
  const nullable = (k: string) => (input[k] === undefined || str(input, k) === "" ? null : str(input, k));
  return {
    name: str(input, "name"),
    description: nullable("description"),
    content: nullable("content"),
    meta_title: nullable("meta_title"),
    meta_keyword: nullable("meta_keyword"),
    meta_description: nullable("meta_description"),
    canonical: slugify(str(input, "canonical")),
  };
}

/** PostCatalogueService::create */
export async function createPostCatalogue(input: Input, languageId: bigint, userId: bigint) {
  return db.$transaction(async (tx) => {
    const t = now();
    const catalogue = await tx.post_catalogues.create({
      data: { ...catalogueFields(input), user_id: userId, created_at: t, updated_at: t },
    });
    const lang = languageFields(input);
    await tx.post_catalogue_language.create({
      data: { ...lang, url: "", post_catalogue_id: catalogue.id, language_id: languageId, created_at: t, updated_at: t },
    });
    await saveRouter(tx, { canonical: lang.canonical, moduleId: catalogue.id, controller: CONTROLLERS.postCatalogue, languageId });
    await postCatalogueNested(languageId).rebuild(tx);
    return catalogue;
  });
}

/** PostCatalogueService::update (detach ban dich cu cua ngon ngu nay roi tao lai) */
export async function updatePostCatalogue(id: bigint, input: Input, languageId: bigint) {
  return db.$transaction(async (tx) => {
    const t = now();
    await tx.post_catalogues.update({ where: { id }, data: { ...catalogueFields(input), updated_at: t } });
    // $postCatalogue->languages()->detach([$languageId, $id]) — xoa ca pivot co language_id = $id (giu nguyen hanh vi)
    await tx.post_catalogue_language.deleteMany({
      where: { post_catalogue_id: id, language_id: { in: [languageId, id] } },
    });
    const lang = languageFields(input);
    await tx.post_catalogue_language.create({
      data: { ...lang, url: "", post_catalogue_id: id, language_id: languageId, created_at: t, updated_at: t },
    });
    await saveRouter(tx, { canonical: lang.canonical, moduleId: id, controller: CONTROLLERS.postCatalogue, languageId });
    await postCatalogueNested(languageId).rebuild(tx);
  });
}

/** PostCatalogueService::destroy — xoa mem + xoa router + tinh lai cay */
export async function destroyPostCatalogue(id: bigint, languageId: bigint) {
  await db.$transaction(async (tx) => {
    await tx.post_catalogues.update({ where: { id }, data: { deleted_at: now() } });
    await tx.routers.deleteMany({ where: { module_id: id, controllers: CONTROLLERS.postCatalogue } });
    await postCatalogueNested(languageId).rebuild(tx);
  });
}

/** PostCatalogue::isNodeCheck — con danh muc con thi khong xoa duoc */
export async function isLeaf(id: bigint) {
  const c = await db.post_catalogues.findUnique({ where: { id }, select: { lft: true, rgt: true } });
  return !!c && c.rgt - c.lft === 1;
}
