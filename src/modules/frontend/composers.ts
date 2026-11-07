import "server-only";
import { cache } from "react";
import { PUBLISH } from "@/lib/constants";
import { db } from "@/lib/db";
import { getCurrentLanguage, getSystem } from "@/lib/language";
import { url, writeUrl } from "./helpers";

/**
 * Cac ViewComposer cua frontend (app/Http/ViewComposers/*, dang ky trong
 * AppServiceProvider cho 'frontend.*'). Moi ham boc cache() nen trong mot request
 * chi truy van mot lan, giong static::$cache cua tung composer.
 *
 * Bo qua: CartComposer (cartShare/wishlistCount/compareCount), LanguageComposer
 * ($languages), CategoryComposer ($category) — khong view WACO nao dung toi.
 */

export { getSystem };

/* --------------------------------- MenuComposer -------------------------------- */

export type MenuNode = {
  id: bigint;
  /** null khi muc menu chua co ban ngon ngu (view bo qua). */
  label: { name: string; url: string } | null;
  children: MenuNode[];
};

type MenuRow = {
  id: bigint;
  parent_id: number;
  menu_catalogue_id: bigint;
  name: string | null;
  canonical: string | null;
  has_lang: bigint | number | null;
};

/**
 * MenuComposer::loadMenuData: moi nhom menu (menu_catalogues publish=2) -> cay
 * recursive(). Muc menu sap TANG theo `order`. Nhan + duong dan tinh giong
 * $menuLabel trong header.blade.php: canonical '' -> url('/'), con lai write_url().
 */
export const getMenu = cache(async (): Promise<Record<string, MenuNode[]>> => {
  const lang = await getCurrentLanguage();
  const catalogues = await db.menu_catalogues.findMany({
    where: { publish: PUBLISH.ON, deleted_at: null },
    orderBy: { id: "desc" },
  });
  if (!catalogues.length) return {};
  const rows = await db.$queryRaw<MenuRow[]>`
    SELECT m.id, m.parent_id, m.menu_catalogue_id, ml.name, ml.canonical, ml.menu_id AS has_lang
    FROM menus m
    LEFT JOIN menu_language ml ON ml.menu_id = m.id AND ml.language_id = ${lang.id}
    WHERE m.deleted_at IS NULL
    ORDER BY m.\`order\` ASC, m.id ASC`;

  const build = (list: MenuRow[], parentId: number): MenuNode[] =>
    list
      .filter((r) => Number(r.parent_id) === parentId)
      .map((r) => ({
        id: r.id,
        label:
          r.has_lang === null
            ? null
            : { name: r.name ?? "", url: r.canonical === "" ? url("/") : writeUrl(r.canonical, true, true) },
        children: build(list, Number(r.id)),
      }));

  const menus: Record<string, MenuNode[]> = {};
  for (const cat of catalogues) {
    const tree = build(
      rows.filter((r) => r.menu_catalogue_id === cat.id),
      0,
    );
    // main-menu: Laravel tao them ban 'html' + '_array'; view WACO chi dung '_array'.
    if (cat.keyword === "main-menu") {
      menus.mobile = tree;
      menus[`${cat.keyword}_array`] = tree;
    }
    menus[cat.keyword] = tree;
  }
  return menus;
});

/* --------------------------------- WacoComposer -------------------------------- */

export type Feature = {
  id: bigint;
  group: string;
  title: string;
  description: string | null;
  value: string | null;
  icon: string | null;
  order: number;
  post_canonical: string | null;
};

/** Bang home_features cua DB next_core co the chua co cot post_id (DB Laravel da co). */
const hasPostIdColumn = cache(async () => {
  const rows = await db.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*) AS n FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'home_features' AND COLUMN_NAME = 'post_id'`;
  return Number(rows[0]?.n ?? 0) > 0;
});

/**
 * WacoComposer: $intro (introduces theo keyword) + $features (home_features
 * publish=2 gom theo group, sap group/order, kem canonical bai viet duoc gan).
 */
export const getWaco = cache(async () => {
  const lang = await getCurrentLanguage();
  const introRows = await db.introduces.findMany({ where: { language_id: lang.id }, orderBy: { id: "asc" } });
  const intro: Record<string, string> = {};
  for (const r of introRows) intro[r.keyword] = r.content ?? "";

  const rows = (await hasPostIdColumn())
    ? await db.$queryRaw<Feature[]>`
        SELECT hf.id, hf.\`group\`, hf.title, hf.description, hf.value, hf.icon, hf.\`order\`, pl.canonical AS post_canonical
        FROM home_features hf
        LEFT JOIN posts p ON p.id = hf.post_id AND p.publish = 2 AND p.deleted_at IS NULL
        LEFT JOIN post_language pl ON pl.post_id = p.id AND pl.language_id = ${lang.id}
        WHERE hf.publish = 2
        ORDER BY hf.\`group\` ASC, hf.\`order\` ASC`
    : await db.$queryRaw<Feature[]>`
        SELECT hf.id, hf.\`group\`, hf.title, hf.description, hf.value, hf.icon, hf.\`order\`, NULL AS post_canonical
        FROM home_features hf
        WHERE hf.publish = 2
        ORDER BY hf.\`group\` ASC, hf.\`order\` ASC`;

  const features: Record<string, Feature[]> = {};
  for (const r of rows) (features[r.group] ??= []).push(r);
  return { intro, features };
});

/** Du lieu chung cho moi trang frontend (thay $system, $menu, $intro, $features). */
export async function getShared() {
  const [system, menu, waco] = await Promise.all([getSystem(), getMenu(), getWaco()]);
  return { system, menu, intro: waco.intro, features: waco.features };
}
