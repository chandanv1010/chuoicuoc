import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { now } from "@/lib/helpers";
import type { Input } from "@/lib/http";
import { listParams, where, type SearchParams } from "@/server/admin-list";
import { inputOf, jsonDecode, phpClean, phpJsonEncode, phpUnion, toPhpArray, type PhpArray } from "./php";

/**
 * SlideRepository + SlideService (app/Services/V1/Core/SlideService.php).
 * Cot item/setting la JSON (cast 'json' cua Eloquent): item = { languageId: [ {image,name,description,canonical,alt,window} ] }.
 */
export type SlideItem = { image?: unknown; name?: unknown; description?: unknown; canonical?: unknown; alt?: unknown; window?: unknown };

export type SlideRow = {
  id: bigint;
  name: string;
  keyword: string;
  item: unknown;
  setting: unknown;
  short_code: string | null;
  publish: number;
};

/** $slide->item[$languageId] (Laravel loi "Undefined array key" khi thieu ngon ngu -> ta tra mang rong). */
export function itemsOf(item: unknown, languageId: bigint | number): SlideItem[] {
  if (!item || typeof item !== "object") return [];
  const list = (item as Record<string, unknown>)[String(languageId)];
  if (Array.isArray(list)) return list as SlideItem[];
  if (list && typeof list === "object") return Object.values(list) as SlideItem[];
  return [];
}

/** SlideService::paginate — select id,name,keyword,item,publish; order id DESC */
export async function paginateSlides(sp: SearchParams) {
  const { perPage, page, offset, keyword, publish } = listParams(sp);
  const cond = where([
    Prisma.sql`deleted_at IS NULL`,
    keyword ? Prisma.sql`name LIKE ${`%${keyword}%`}` : null,
    publish ? Prisma.sql`publish = ${publish}` : null,
  ]);
  const [rows, count] = await Promise.all([
    db.$queryRaw<{ id: bigint; name: string; keyword: string; item: string; publish: number }[]>`
      SELECT id, name, keyword, item, publish FROM slides ${cond} ORDER BY id DESC LIMIT ${perPage} OFFSET ${offset}`,
    db.$queryRaw<{ c: bigint }[]>`SELECT COUNT(*) AS c FROM slides ${cond}`,
  ]);
  return {
    rows: rows.map((r) => ({ ...r, item: jsonDecode(r.item) })),
    total: Number(count[0].c),
    perPage,
    page,
  };
}

/** SlideRepository::findById (findOrFail: da xoa mem thi null) */
export async function findSlide(id: bigint): Promise<SlideRow | null> {
  const s = await db.slides.findFirst({ where: { id, deleted_at: null } });
  if (!s) return null;
  return { ...s, item: jsonDecode(s.item), setting: jsonDecode(s.setting) };
}

/** SlideService::converSlideArray: [{image,..}] -> {image:[], description:[], ...} */
export function converSlideArray(slide: SlideItem[]) {
  const temp: Record<string, unknown[]> = {};
  const fields = ["image", "description", "window", "canonical", "name", "alt"] as const;
  for (const val of slide) for (const f of fields) (temp[f] ??= []).push(val?.[f] ?? null);
  return temp;
}

/** SlideService::handleSlideItem — giu nguyen loi lech chi so cua checkbox window[] */
function handleSlideItem(input: Input, languageId: bigint): PhpArray {
  const slide = (phpClean(input.slide) ?? {}) as Record<string, unknown>;
  const col = (k: string) => toPhpArray(slide[k]);
  const image = col("image");
  const name = col("name");
  const description = col("description");
  const canonical = col("canonical");
  const alt = col("alt");
  const win = col("window");
  const list: Record<string, unknown>[] = [];
  for (const [key, val] of image) {
    list.push({
      image: val,
      name: name.get(key) ?? null,
      description: description.get(key) ?? null,
      canonical: canonical.get(key) ?? null,
      alt: alt.get(key) ?? null,
      window: win.has(key) ? win.get(key) : "",
    });
  }
  return new Map([[String(languageId), list]]);
}

/** $request->only(['_token','name','keyword','setting','short_code']) — _token khong co cot nen bo qua */
function basePayload(input: Input) {
  const data: { name?: string; keyword?: string; setting?: string; short_code?: string | null } = {};
  if ("name" in input) data.name = inputOf(input, "name") ?? "";
  if ("keyword" in input) data.keyword = inputOf(input, "keyword") ?? "";
  if ("setting" in input) data.setting = phpJsonEncode(phpClean(input.setting));
  if ("short_code" in input) data.short_code = inputOf(input, "short_code");
  return data;
}

/** SlideService::create (publish khong co trong payload -> mac dinh cot = 0, giong ban goc) */
export async function createSlide(input: Input, languageId: bigint) {
  const t = now();
  const data = basePayload(input);
  await db.slides.create({
    data: {
      name: data.name ?? "",
      keyword: data.keyword ?? "",
      setting: data.setting ?? "null",
      short_code: data.short_code,
      item: phpJsonEncode(handleSlideItem(input, languageId)),
      created_at: t,
      updated_at: t,
    },
  });
}

/** SlideService::update: item = handleSlideItem + (item cu bo ngon ngu hien tai) */
export async function updateSlide(id: bigint, input: Input, languageId: bigint) {
  await db.$transaction(async (tx) => {
    const slide = await tx.slides.findFirst({ where: { id, deleted_at: null } });
    if (!slide) throw new Error("ModelNotFound");
    const old = toPhpArray(jsonDecode(slide.item));
    old.delete(String(languageId));
    const item = phpUnion(handleSlideItem(input, languageId), old);
    await tx.slides.update({ where: { id }, data: { ...basePayload(input), item: phpJsonEncode(item), updated_at: now() } });
  });
}

/** SlideService::destroy — xoa mem */
export async function destroySlide(id: bigint) {
  const r = await db.slides.updateMany({ where: { id, deleted_at: null }, data: { deleted_at: now() } });
  if (!r.count) throw new Error("ModelNotFound");
}

/**
 * SlideService::updateSlideOrder. Giu nguyen hanh vi goc:
 *   $payload['item'][$language] = $temp + $slideItem  (slideItem = item cu bo ngon ngu hien tai)
 * => cot item chi con lai khoa ngon ngu hien tai.
 */
export async function updateSlideOrder(post: Record<string, unknown>[], languageId: bigint) {
  if (!post.length) return;
  const slideId = String(post[0]?.id ?? "");
  if (!/^\d+$/.test(slideId)) return;
  const temp = post.map((item) => {
    const { id: _id, ...rest } = item;
    return rest;
  });
  const slide = await db.slides.findFirst({ where: { id: BigInt(slideId), deleted_at: null } });
  if (!slide) return;
  const slideItem = toPhpArray(jsonDecode(slide.item));
  slideItem.delete(String(languageId));
  const merged = phpUnion(toPhpArray(temp), slideItem);
  const item: PhpArray = new Map([[String(languageId), merged]]);
  await db.slides.update({ where: { id: slide.id }, data: { item: phpJsonEncode(item), updated_at: now() } });
}
