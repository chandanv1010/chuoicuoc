import "server-only";
import { Prisma } from "@prisma/client";
import { cache } from "react";
import { CONTROLLERS, PUBLISH } from "@/lib/constants";
import { db } from "@/lib/db";
import { getCurrentLanguage } from "@/lib/language";
import { jsonDecode } from "./helpers";

/**
 * Router + Slide + Widget phia website:
 *   - RouterController::getRouter (bang routers theo canonical + ngon ngu)
 *   - SlideService::getSlide
 *   - WidgetService::getWidget (chi nhanh dung cho trang WACO: ProductCatalogue, Post)
 */

/** FrontendController::setLanguage(): $this->language = 1 (co dinh). */
export const FRONTEND_LANGUAGE = 1n;

export const findRouter = cache(async (canonical: string) =>
  db.routers.findFirst({ where: { canonical, language_id: FRONTEND_LANGUAGE } }),
);

export const ROUTER_CONTROLLERS = CONTROLLERS;

/* ------------------------------------ Slide ------------------------------------ */

export type SlideItem = { image: string; name: string; alt: string; description?: string; canonical?: string; window?: string };

/** SlideService::getSlide($keywords, $language): [keyword => {name, short_code, item, setting}] */
export const getSlides = cache(async (keywords: string[], language = 1) => {
  const rows = await db.slides.findMany({
    where: { publish: PUBLISH.ON, deleted_at: null, keyword: { in: keywords } },
    orderBy: { id: "desc" },
  });
  const out: Record<string, { name: string; short_code: string | null; item: SlideItem[]; setting: unknown }> = {};
  for (const r of rows) {
    const item = jsonDecode<Record<string, SlideItem[]>>(r.item) ?? {};
    out[r.keyword] = {
      name: r.name,
      short_code: r.short_code,
      item: item[String(language)] ?? [],
      setting: jsonDecode(r.setting),
    };
  }
  return out;
});

/* ------------------------------------ Widget ----------------------------------- */

type WidgetRow = { id: bigint; keyword: string; model: string; model_id: string | null };

async function widgetRow(keyword: string): Promise<{ row: WidgetRow; ids: number[] } | null> {
  const rows = await db.$queryRaw<WidgetRow[]>`
    SELECT id, keyword, model, model_id FROM widgets
    WHERE keyword = ${keyword} AND publish = 2 AND deleted_at IS NULL`;
  const row = rows[0];
  if (!row) return null;
  const decoded = jsonDecode<unknown>(row.model_id);
  const raw = typeof row.model_id === "string" && decoded ? (Array.isArray(decoded) ? decoded : [decoded]) : [row.model_id];
  const ids = raw.map((x) => (/^\d+(\.\d+)?$/.test(String(x)) ? Math.trunc(Number(x)) : 0));
  return { row, ids };
}

/** Sap lai theo thu tu model_id ma quan tri chon (HomeController::theoThuTuWidget). */
function sortByWidget<T extends { id: bigint }>(items: T[], ids: number[]): T[] {
  const pos = new Map<number, number>();
  ids.forEach((id, i) => pos.set(id, i)); // array_flip: id trung -> vi tri cuoi
  return items
    .map((item, i) => ({ item, i }))
    .sort((a, b) => {
      const pa = pos.get(Number(a.item.id)) ?? Number.MAX_SAFE_INTEGER;
      const pb = pos.get(Number(b.item.id)) ?? Number.MAX_SAFE_INTEGER;
      return pa - pb || a.i - b.i;
    })
    .map((x) => x.item);
}

export type WidgetCatalogue = {
  id: bigint;
  icon: string | null;
  image: string | null;
  lang: { name: string | null; canonical: string | null; description: string | null };
};

/**
 * Widget model ProductCatalogue (vd homepage-categories): danh muc publish=2,
 * kem ban ngon ngu (LEFT JOIN), da xep theo thu tu widget.
 */
export const getCatalogueWidget = cache(async (keyword: string): Promise<WidgetCatalogue[]> => {
  const w = await widgetRow(keyword);
  if (!w || !w.row.model.includes("Catalogue")) return [];
  const ids = [...new Set(w.ids.filter((id) => id > 0))];
  if (!ids.length) return [];
  const lang = await getCurrentLanguage();
  const rows = await db.$queryRaw<
    { id: bigint; icon: string | null; image: string | null; name: string | null; canonical: string | null; description: string | null }[]
  >`
    SELECT c.id, c.icon, c.image, cl.name, cl.canonical, cl.description
    FROM product_catalogues c
    LEFT JOIN product_catalogue_language cl ON c.id = cl.product_catalogue_id AND cl.language_id = ${lang.id}
    WHERE c.id IN (${joinIds(ids)}) AND c.publish = 2 AND c.deleted_at IS NULL
    ORDER BY c.\`order\` DESC, c.id DESC`;
  return sortByWidget(
    rows.map((r) => ({ id: r.id, icon: r.icon, image: r.image, lang: { name: r.name, canonical: r.canonical, description: r.description } })),
    w.ids,
  );
});

export type WidgetPost = {
  id: bigint;
  image: string | null;
  released_at: Date | null;
  created_at: Date | null;
  lang: { name: string | null; canonical: string | null; description: string | null };
};

/** Widget model Post (vd homepage-news). */
export const getPostWidget = cache(async (keyword: string): Promise<WidgetPost[]> => {
  const w = await widgetRow(keyword);
  if (!w || w.row.model !== "Post") return [];
  const ids = [...new Set(w.ids.filter((id) => id > 0))];
  if (!ids.length) return [];
  const lang = await getCurrentLanguage();
  const rows = await db.$queryRaw<
    { id: bigint; image: string | null; released_at: Date | null; created_at: Date | null; name: string | null; canonical: string | null; description: string | null }[]
  >`
    SELECT o.id, o.image, o.released_at, o.created_at, ol.name, ol.canonical, ol.description
    FROM posts o
    LEFT JOIN post_language ol ON o.id = ol.post_id AND ol.language_id = ${lang.id}
    WHERE o.id IN (${joinIds(ids)}) AND o.publish = 2 AND o.deleted_at IS NULL
    ORDER BY o.\`order\` DESC`;
  return sortByWidget(
    rows.map((r) => ({
      id: r.id,
      image: r.image,
      released_at: r.released_at,
      created_at: r.created_at,
      lang: { name: r.name, canonical: r.canonical, description: r.description },
    })),
    w.ids,
  );
});

function joinIds(ids: number[]) {
  return Prisma.join(ids.map((id) => BigInt(id)));
}
