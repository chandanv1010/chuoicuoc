import "server-only";
import { Prisma } from "@prisma/client";
import { CONTROLLERS } from "@/lib/constants";
import { db } from "@/lib/db";
import { now } from "@/lib/helpers";
import { arr, str, type Input } from "@/lib/http";
import { slugify } from "@/lib/slug";
import { intParam, param, where, type SearchParams } from "@/server/admin-list";
import { saveRouter } from "@/server/router";
import { formatAlbum } from "./post-catalogue";

/** PostRepository + PostService (app/Services/V1/Post/PostService.php). */

export type PostRow = {
  id: bigint;
  publish: number;
  image: string | null;
  order: number;
  viewed: number;
  name: string;
  canonical: string;
};

/**
 * PostService::paginate (admin): 20 dong/trang (co dinh, khong doc perpage),
 * loc theo post_catalogue_id gom ca danh muc con, sap xep posts.id DESC.
 */
export async function paginatePosts(sp: SearchParams, languageId: bigint) {
  const perPage = 20;
  const page = Math.max(1, intParam(sp, "page") || 1);
  const keyword = (param(sp, "keyword") ?? "").trim();
  const publish = intParam(sp, "publish");
  const catId = intParam(sp, "post_catalogue_id");
  const cond = where([
    keyword ? Prisma.sql`tb2.name LIKE ${`%${keyword}%`}` : null,
    publish ? Prisma.sql`posts.publish = ${publish}` : null,
    Prisma.sql`tb2.language_id = ${languageId}`,
    catId > 0
      ? Prisma.sql`tb3.post_catalogue_id IN (
          SELECT id FROM post_catalogues
          JOIN post_catalogue_language ON post_catalogues.id = post_catalogue_language.post_catalogue_id
          WHERE lft >= (SELECT lft FROM post_catalogues AS pc WHERE pc.id = ${catId})
            AND rgt <= (SELECT rgt FROM post_catalogues AS pc WHERE pc.id = ${catId})
            AND post_catalogue_language.language_id = ${languageId})`
      : null,
    Prisma.sql`posts.deleted_at IS NULL`,
  ]);
  const from = Prisma.sql`FROM posts
    JOIN post_language AS tb2 ON tb2.post_id = posts.id
    JOIN post_catalogue_post AS tb3 ON posts.id = tb3.post_id`;
  const [rows, count] = await Promise.all([
    db.$queryRaw<PostRow[]>`
      SELECT posts.id, posts.publish, posts.image, posts.\`order\`, posts.viewed, tb2.name, tb2.canonical
      ${from} ${cond}
      GROUP BY posts.id, posts.publish, posts.image, posts.\`order\`, posts.viewed, tb2.name, tb2.canonical
      ORDER BY posts.id DESC
      LIMIT ${perPage} OFFSET ${(page - 1) * perPage}`,
    db.$queryRaw<{ c: bigint }[]>`SELECT COUNT(DISTINCT posts.id) AS c ${from} ${cond}`,
  ]);
  return { rows, total: Number(count[0].c), perPage, page };
}

/** $post->post_catalogues + post_catalogue_language (moi ngon ngu) cho cot "Nhom". */
export async function catalogueNamesOfPosts(ids: bigint[]) {
  const map = new Map<string, { id: bigint; names: string[] }[]>();
  if (!ids.length) return map;
  const rows = await db.$queryRaw<{ post_id: bigint; id: bigint; name: string | null }[]>`
    SELECT pcp.post_id, pc.id, pcl.name
    FROM post_catalogue_post pcp
    JOIN post_catalogues pc ON pc.id = pcp.post_catalogue_id AND pc.deleted_at IS NULL
    LEFT JOIN post_catalogue_language pcl ON pcl.post_catalogue_id = pc.id
    WHERE pcp.post_id IN (${Prisma.join(ids)})
    ORDER BY pcp.post_id, pc.id, pcl.language_id`;
  for (const r of rows) {
    const key = r.post_id.toString();
    const list = map.get(key) ?? [];
    let cat = list.find((c) => c.id === r.id);
    if (!cat) list.push((cat = { id: r.id, names: [] }));
    if (r.name !== null) cat.names.push(r.name);
    map.set(key, list);
  }
  return map;
}

/** PostRepository::getPostById (kem danh sach id danh muc phu). */
export async function getPostById(id: bigint, languageId: bigint) {
  const rows = await db.$queryRaw<
    {
      id: bigint;
      post_catalogue_id: number;
      image: string | null;
      icon: string | null;
      album: string | null;
      publish: number;
      follow: number;
      video: string | null;
      template: number | null;
      viewed: number;
      status_menu: number;
      short_name: string | null;
      logo: string | null;
      extra: string | null;
      comments: string | null;
      rate: string | null;
      post_type: string;
      recommend: string;
      name: string;
      description: string | null;
      content: string | null;
      meta_title: string | null;
      meta_keyword: string | null;
      meta_description: string | null;
      canonical: string;
    }[]
  >`
    SELECT posts.id, posts.post_catalogue_id, posts.image, posts.icon, posts.album, posts.publish, posts.follow,
           posts.video, posts.template, posts.viewed, posts.status_menu, posts.short_name, posts.logo, posts.extra,
           posts.comments, posts.rate, posts.post_type, posts.recommend, tb2.name, tb2.description, tb2.content,
           tb2.meta_title, tb2.meta_keyword, tb2.meta_description, tb2.canonical
    FROM posts JOIN post_language AS tb2 ON tb2.post_id = posts.id
    WHERE posts.id = ${id} AND tb2.language_id = ${languageId} AND posts.deleted_at IS NULL
    LIMIT 1`;
  const post = rows[0];
  if (!post) return null;
  const cats = await db.$queryRaw<{ id: bigint }[]>`
    SELECT pc.id FROM post_catalogue_post pcp JOIN post_catalogues pc ON pc.id = pcp.post_catalogue_id
    WHERE pcp.post_id = ${id} AND pc.deleted_at IS NULL`;
  return { ...post, catalogueIds: cats.map((c) => c.id.toString()) };
}

function nullable(input: Input, k: string) {
  return input[k] === undefined || str(input, k) === "" ? null : str(input, k);
}

/** $request->only(payload()): chi gan cot co trong request (giong Eloquent fill). */
function postFields(input: Input) {
  const out: Record<string, unknown> = { album: formatAlbum(input) };
  const intOf = (k: string) => Number.parseInt(str(input, k, "0"), 10) || 0;
  if (input.follow !== undefined) out.follow = intOf("follow");
  if (input.publish !== undefined) out.publish = intOf("publish");
  if (input.image !== undefined) out.image = nullable(input, "image");
  if (input.post_catalogue_id !== undefined) out.post_catalogue_id = intOf("post_catalogue_id");
  if (input.video !== undefined) out.video = nullable(input, "video");
  if (input.template !== undefined) out.template = input.template === "" ? null : intOf("template");
  if (input.status_menu !== undefined) out.status_menu = intOf("status_menu");
  for (const k of ["short_name", "logo", "extra", "comments", "rate"]) if (input[k] !== undefined) out[k] = nullable(input, k);
  // enum posts_recommend: Prisma dat ten v1/v2 cho gia tri '1'/'2'
  if (input.recommend !== undefined) out.recommend = str(input, "recommend") === "2" ? "v2" : "v1";
  if (input.post_type !== undefined) out.post_type = str(input, "post_type") || "post";
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

/** PostService::catalogue(): catalogue[] + post_catalogue_id, khong trung. */
function catalogueIds(input: Input) {
  const main = str(input, "post_catalogue_id");
  return [...new Set([...arr(input, "catalogue"), main])].filter((x) => /^\d+$/.test(x));
}

async function syncCatalogues(tx: Prisma.TransactionClient, postId: bigint, ids: string[]) {
  await tx.$executeRaw`DELETE FROM post_catalogue_post WHERE post_id = ${postId}`;
  for (const cid of ids) await tx.$executeRaw`INSERT INTO post_catalogue_post (post_catalogue_id, post_id) VALUES (${cid}, ${postId})`;
}

async function saveTranslation(tx: Prisma.TransactionClient, postId: bigint, input: Input, languageId: bigint) {
  const t = now();
  // $post->languages()->detach([$languageId, $post->id]) — giu nguyen hanh vi goc
  await tx.post_language.deleteMany({ where: { post_id: postId, language_id: { in: [languageId, postId] } } });
  const lang = languageFields(input);
  await tx.post_language.create({ data: { ...lang, post_id: postId, language_id: languageId, created_at: t, updated_at: t } });
  return lang;
}

export async function createPost(input: Input, languageId: bigint, userId: bigint) {
  return db.$transaction(async (tx) => {
    const t = now();
    const fields = postFields(input);
    const post = await tx.posts.create({
      data: { follow: 0, files: "", ...fields, user_id: userId, created_at: t, updated_at: t } as Prisma.postsUncheckedCreateInput,
    });
    const lang = await saveTranslation(tx, post.id, input, languageId);
    await syncCatalogues(tx, post.id, catalogueIds(input));
    await saveRouter(tx, { canonical: lang.canonical, moduleId: post.id, controller: CONTROLLERS.post, languageId });
    return post;
  });
}

export async function updatePost(id: bigint, input: Input, languageId: bigint) {
  await db.$transaction(async (tx) => {
    await tx.posts.update({ where: { id }, data: { ...postFields(input), updated_at: now() } as Prisma.postsUncheckedUpdateInput });
    const lang = await saveTranslation(tx, id, input, languageId);
    await syncCatalogues(tx, id, catalogueIds(input));
    await saveRouter(tx, { canonical: lang.canonical, moduleId: id, controller: CONTROLLERS.post, languageId });
  });
}

export async function destroyPost(id: bigint) {
  await db.$transaction(async (tx) => {
    await tx.posts.update({ where: { id }, data: { deleted_at: now() } });
    await tx.routers.deleteMany({ where: { module_id: id, controllers: CONTROLLERS.post } });
  });
}
