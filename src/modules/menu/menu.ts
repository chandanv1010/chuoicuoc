import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { now } from "@/lib/helpers";
import type { Input } from "@/lib/http";
import { listParams, where, type SearchParams } from "@/server/admin-list";
import { nestedSet } from "@/server/nested-set";
import { phpClean, phpString } from "@/modules/slide/php";

/**
 * MenuCatalogueRepository/Service + MenuRepository/MenuService
 * (app/Services/V1/Menu/*.php, app/Repositories/Menu/*.php).
 * Bang menu_language khong co khoa chinh (@@ignore) nen dung $queryRaw/$executeRaw.
 */
type Tx = Prisma.TransactionClient;

export const menuNested = (languageId: bigint) => nestedSet({ table: "menus", foreignKey: "menu_id", languageId, isMenu: true });

/* ---------------------------- menu_catalogues ---------------------------- */

/** MenuCatalogueService::paginate — select id,name,keyword,publish; order id DESC */
export async function paginateMenuCatalogues(sp: SearchParams) {
  const { perPage, page, offset, keyword, publish } = listParams(sp);
  const cond = where([
    Prisma.sql`deleted_at IS NULL`,
    keyword ? Prisma.sql`name LIKE ${`%${addslashes(keyword)}%`}` : null,
    publish ? Prisma.sql`publish = ${publish}` : null,
  ]);
  const [rows, count] = await Promise.all([
    db.$queryRaw<{ id: bigint; name: string; keyword: string; publish: number }[]>`
      SELECT id, name, keyword, publish FROM menu_catalogues ${cond} ORDER BY id DESC LIMIT ${perPage} OFFSET ${offset}`,
    db.$queryRaw<{ c: bigint }[]>`SELECT COUNT(*) AS c FROM menu_catalogues ${cond}`,
  ]);
  return { rows, total: Number(count[0].c), perPage, page };
}

/** MenuCatalogueRepository::all() (Eloquent: bo ban ghi xoa mem, thu tu theo id) */
export function allMenuCatalogues() {
  return db.menu_catalogues.findMany({ where: { deleted_at: null }, orderBy: { id: "asc" } });
}

/** MenuCatalogueRepository::findById (findOrFail) */
export function findMenuCatalogue(id: bigint) {
  return db.menu_catalogues.findFirst({ where: { id, deleted_at: null } });
}

/** MenuCatalogueService::create (ajax createCatalogue): keyword = Str::slug */
export async function createMenuCatalogue(name: string, keyword: string) {
  const t = now();
  const c = await db.menu_catalogues.create({ data: { name, keyword: strSlug(keyword), created_at: t, updated_at: t } });
  return { name: c.name, id: Number(c.id) };
}

/* --------------------------------- menus --------------------------------- */

export type MenuRow = {
  id: bigint;
  parent_id: number;
  menu_catalogue_id: bigint;
  lft: number;
  rgt: number;
  level: number;
  icon: string | null;
  order: number;
  // pivot cua ngon ngu dang loc ($menu->languages->first()->pivot); null neu chua co ban dich
  name: string | null;
  canonical: string | null;
  has_lang: number;
};

/**
 * MenuRepository::findByCondition(..., relation languages where language_id = $languageId, orderBy).
 * LEFT JOIN de giu ca menu chua co ban dich (languages rong).
 */
async function findMenus(cond: Prisma.Sql, languageId: bigint, orderBy: Prisma.Sql) {
  return db.$queryRaw<MenuRow[]>`
    SELECT m.id, m.parent_id, m.menu_catalogue_id, m.lft, m.rgt, m.level, m.icon, m.\`order\`,
           ml.name, ml.canonical, (ml.menu_id IS NOT NULL) AS has_lang
    FROM menus m
    LEFT JOIN (
      SELECT menu_id, MIN(name) AS name, MIN(canonical) AS canonical FROM menu_language
      WHERE language_id = ${languageId} GROUP BY menu_id
    ) ml ON ml.menu_id = m.id
    WHERE m.deleted_at IS NULL AND ${cond}
    ORDER BY ${orderBy}`;
}

/** MenuController@edit: menu cua vi tri, sap xep order ASC */
export function menusOfCatalogue(catalogueId: bigint, languageId: bigint) {
  return findMenus(Prisma.sql`m.menu_catalogue_id = ${catalogueId}`, languageId, Prisma.sql`m.\`order\` ASC`);
}

/** MenuController@editMenu: chi menu cap 1 */
export function rootMenusOfCatalogue(catalogueId: bigint, languageId: bigint) {
  return findMenus(Prisma.sql`m.menu_catalogue_id = ${catalogueId} AND m.parent_id = 0`, languageId, Prisma.sql`m.\`order\` ASC`);
}

/** MenuController@translate: sap xep lft ASC */
export function menusOfCatalogueByLft(catalogueId: bigint, languageId: bigint) {
  return findMenus(Prisma.sql`m.menu_catalogue_id = ${catalogueId}`, languageId, Prisma.sql`m.lft ASC`);
}

/** MenuService::getAndConvertMenu: menu con truc tiep, orderBy id DESC (mac dinh findByCondition) */
export async function childMenus(menuId: bigint, languageId: bigint) {
  return findMenus(Prisma.sql`m.parent_id = ${menuId}`, languageId, Prisma.sql`m.id DESC`);
}

/** MenuRepository::findById (findOrFail) kem ban dich ngon ngu hien tai */
export async function findMenu(id: bigint, languageId: bigint) {
  const rows = await findMenus(Prisma.sql`m.id = ${id}`, languageId, Prisma.sql`m.id`);
  return rows[0] ?? null;
}

/** MenuService::convertMenu -> { name:[], canonical:[], order:[], id:[], icon:[] } */
export function convertMenu(list: MenuRow[]) {
  const temp: Record<string, unknown[]> = {};
  for (const val of list) {
    (temp.name ??= []).push(val.has_lang ? val.name : "");
    (temp.canonical ??= []).push(val.has_lang ? val.canonical : "");
    (temp.order ??= []).push(val.order);
    (temp.id ??= []).push(Number(val.id));
    (temp.icon ??= []).push(val.icon);
  }
  return temp;
}

/** helper recursive() trong MyHelper.php */
export type MenuNode = { item: MenuRow; children: MenuNode[] };
export function recursive(data: MenuRow[], parentId: number | bigint = 0): MenuNode[] {
  return data
    .filter((v) => Number(v.parent_id) === Number(parentId))
    .map((v) => ({ item: v, children: recursive(data, v.id) }));
}

/** helper recursive_menu(): HTML cay nestable (nhay don, ten khong escape — giong ban goc) */
export function recursiveMenu(data: MenuNode[]): string {
  let html = "";
  for (const val of data) {
    const itemId = val.item.id.toString();
    const itemName = val.item.has_lang ? (val.item.name ?? "") : "(No name)";
    const itemUrl = `${appUrl()}menu/${itemId}/children`;
    html += `<li class='dd-item' data-id='${itemId}'>`;
    html += `<div class='dd-handle'>`;
    html += `<span class='label label-info'><i class='fa fa-arrows'></i></span> ${itemName}`;
    html += `</div>`;
    html += `<a class='create-children-menu' href='${itemUrl}'> Quản lý menu con </a>`;
    if (val.children.length) {
      html += `<ol class='dd-list'>`;
      html += recursiveMenu(val.children);
      html += "</ol>";
    }
    html += "</li>";
  }
  return html;
}

/** helper buildMenu(): them position "1", "1.2"... theo thu tu danh sach */
export function buildMenu<T extends { id: bigint; parent_id: number }>(menus: T[], parentId = 0, prefix = ""): (T & { position: string })[] {
  const output: (T & { position: string })[] = [];
  let count = 1;
  for (const val of menus) {
    if (Number(val.parent_id) === parentId) {
      const position = `${prefix}${count}`;
      output.push({ ...val, position });
      output.push(...buildMenu(menus, Number(val.id), `${position}.`));
      count++;
    }
  }
  return output;
}

function appUrl() {
  return (process.env.APP_URL ?? "/").replace(/\/?$/, "/");
}

/* ------------------------------- ghi du lieu ------------------------------ */

type MenuForm = { name: unknown[]; canonical: unknown[]; order: unknown[]; id: unknown[]; icon?: unknown[] };

function menuForm(input: Input): MenuForm {
  const menu = (phpClean(input.menu) ?? {}) as Record<string, unknown>;
  const list = (k: string) => {
    const v = menu[k];
    return Array.isArray(v) ? v : v && typeof v === "object" ? Object.values(v) : [];
  };
  return { name: list("name"), canonical: list("canonical"), order: list("order"), id: list("id"), icon: menu.icon === undefined ? undefined : list("icon") };
}

/** (int)$x cua PHP */
function phpInt(v: unknown): number {
  const n = Number.parseInt(String(v ?? "0").trim(), 10);
  return Number.isNaN(n) ? 0 : n;
}

/** $menuId == 0 (so sanh long PHP 8) */
function isZero(v: unknown) {
  if (v === null || v === undefined) return true;
  const s = String(v).trim();
  return /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(s) ? Number(s) === 0 : false;
}

/** BaseRepository::update: fill + save — chi ghi khi co thay doi (updated_at cung chi doi khi do) */
async function updateMenuRow(tx: Tx, id: bigint, data: Record<string, unknown>) {
  const cur = await tx.menus.findUnique({ where: { id } });
  if (!cur) throw new Error("ModelNotFound");
  const dirty: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    const old = (cur as Record<string, unknown>)[k];
    if (String(old ?? "") !== String(v ?? "") || (old === null) !== (v === null)) dirty[k] = v;
  }
  if (Object.keys(dirty).length) {
    await tx.menus.update({ where: { id }, data: { ...(dirty as Prisma.menusUpdateInput), updated_at: now() } });
    return { ...cur, ...dirty } as typeof cur;
  }
  return cur;
}

async function createMenuRow(tx: Tx, data: { menu_catalogue_id: bigint; parent_id?: number; order: number; user_id: bigint; icon?: string | null }) {
  const t = now();
  return tx.menus.create({ data: { ...data, created_at: t, updated_at: t } });
}

/** $menu->languages()->detach([$languageId, $menu->id]) + attach($menu->id, [language_id, name, canonical]) */
async function replacePivot(tx: Tx, menuId: bigint, languageId: bigint, name: string | null, canonical: string | null) {
  await tx.$executeRaw`DELETE FROM menu_language WHERE menu_id = ${menuId} AND language_id IN (${languageId}, ${menuId})`;
  const t = now();
  await tx.$executeRaw`INSERT INTO menu_language (menu_id, language_id, name, canonical, created_at, updated_at)
    VALUES (${menuId}, ${languageId}, ${name}, ${canonical}, ${t}, ${t})`;
}

/** Menu::find / onlyTrashed()->find / create — nhanh tim ban ghi cua MenuService::save & saveChildren */
async function upsertMenu(tx: Tx, menuId: unknown, data: Record<string, unknown>, onUpdated?: (m: { lft: number; rgt: number }) => Promise<void>) {
  if (isZero(menuId)) return { saved: await createMenuRow(tx, data as Parameters<typeof createMenuRow>[1]), found: null };
  const idStr = String(menuId).trim();
  const id = /^\d+$/.test(idStr) ? BigInt(idStr) : null;
  const row = id ? await tx.menus.findUnique({ where: { id } }) : null;
  if (row && row.deleted_at === null) {
    const saved = await updateMenuRow(tx, row.id, data);
    if (onUpdated) await onUpdated(saved);
    return { saved, found: saved };
  }
  if (row) {
    // restore() roi update
    await tx.menus.update({ where: { id: row.id }, data: { deleted_at: null, updated_at: now() } });
    return { saved: await updateMenuRow(tx, row.id, data), found: null };
  }
  return { saved: await createMenuRow(tx, data as Parameters<typeof createMenuRow>[1]), found: null };
}

/** MenuService::save (form menu/store) */
export async function saveMenu(input: Input, languageId: bigint, userId: bigint) {
  const menu = menuForm(input);
  const catalogueId = phpString(input.menu_catalogue_id) ?? "0";
  await db.$transaction(
    async (tx) => {
      if (!menu.name.length) return;
      for (let key = 0; key < menu.name.length; key++) {
        const data: Record<string, unknown> = {
          menu_catalogue_id: BigInt(phpInt(catalogueId)),
          order: phpInt(menu.order[key]),
          user_id: userId,
        };
        // isset($payload['menu']['icon'][$key]): null (o rong) thi khong ghi
        if (menu.icon && menu.icon[key] !== null && menu.icon[key] !== undefined) data.icon = menu.icon[key];
        const { saved } = await upsertMenu(tx, menu.id[key], data, async (m) => {
          if (m.rgt - m.lft > 1) {
            // updateByWhere: lft > ? AND rgt < ? (toan bang, chi ban ghi chua xoa mem)
            await tx.$executeRaw`UPDATE menus SET menu_catalogue_id = ${BigInt(phpInt(catalogueId))}, updated_at = ${now()}
              WHERE lft > ${m.lft} AND rgt < ${m.rgt} AND deleted_at IS NULL`;
          }
        });
        await replacePivot(tx, saved.id, languageId, toNameOrNull(menu.name[key]), toNameOrNull(menu.canonical[key]));
      }
      await menuNested(languageId).rebuild(tx);
    },
    { timeout: 60_000 },
  );
}

function toNameOrNull(v: unknown): string | null {
  return v === null || v === undefined ? null : String(v);
}

/**
 * MenuService::saveChildren. Da sua loi ban goc: Laravel gan lai bien $menu bang
 * Menu::find($menuId) trong vong lap, nen tu muc thu 2 tro di parent_id/menu_catalogue_id
 * lay theo menu con cua vong truoc -> luu tu 2 menu con co san tro len la long sai cay.
 * Gio moi muc deu gan vao dung menu cha.
 */
export async function saveChildren(input: Input, languageId: bigint, parent: { id: bigint; menu_catalogue_id: bigint }, userId: bigint) {
  const menu = menuForm(input);
  await db.$transaction(
    async (tx) => {
      if (!menu.name.length) return;
      for (let key = 0; key < menu.name.length; key++) {
        const data: Record<string, unknown> = {
          menu_catalogue_id: parent.menu_catalogue_id,
          parent_id: Number(parent.id),
          order: phpInt(menu.order[key]),
          user_id: userId,
        };
        const menuId = menu.id[key];
        const { saved } = await upsertMenu(tx, menuId, data);
        await replacePivot(tx, saved.id, languageId, toNameOrNull(menu.name[key]), toNameOrNull(menu.canonical[key]));
      }
      await menuNested(languageId).rebuild(tx);
    },
    { timeout: 60_000 },
  );
}

/** MenuService::dragUpdate (khong co transaction, giong ban goc) */
export async function dragUpdate(json: unknown, languageId: bigint, parentId = 0): Promise<void> {
  const list = Array.isArray(json) ? json : json && typeof json === "object" ? Object.values(json) : [];
  for (let key = 0; key < list.length; key++) {
    const val = list[key] as { id?: unknown; children?: unknown };
    const id = BigInt(phpInt(val?.id));
    // menuRepository->update -> findOrFail (bo qua ban ghi xoa mem)
    if (!(await db.menus.findFirst({ where: { id, deleted_at: null }, select: { id: true } }))) throw new Error("ModelNotFound");
    await updateMenuRow(db as unknown as Tx, id, { order: key, parent_id: parentId });
    const children = val?.children;
    if (children && typeof children === "object" && Object.keys(children).length) {
      await dragUpdate(children, languageId, Number(id));
    }
  }
  await menuNested(languageId).rebuild(db);
}

/** MenuService::destroy: xoa han menu cua vi tri + vi tri */
export async function destroyMenuCatalogue(id: bigint) {
  await db.$transaction(async (tx) => {
    await tx.$executeRaw`DELETE FROM menus WHERE menu_catalogue_id = ${id}`;
    const c = await tx.menu_catalogues.findFirst({ where: { id, deleted_at: null } });
    if (!c) throw new Error("ModelNotFound");
    await tx.menu_catalogues.delete({ where: { id } });
  });
}

/** MenuService::destroyMenu: xoa han cac menu co lft trong [lft, rgt] cua menu (toan bang) */
export async function destroyMenu(id: bigint, languageId: bigint) {
  await db.$transaction(
    async (tx) => {
      const menu = await tx.menus.findFirst({ where: { id, deleted_at: null } });
      if (!menu) throw new Error("No query results for model [App\\Models\\Menu] " + id);
      await tx.$executeRaw`DELETE FROM menus WHERE lft >= ${menu.lft} AND lft <= ${menu.rgt}`;
      await menuNested(languageId).rebuild(tx);
    },
    { timeout: 60_000 },
  );
}

/* -------------------------------- ban dich -------------------------------- */

/**
 * MenuService::findMenuItemTranslate. Nhanh du phong (tim theo routers) cua ban goc
 * goi '\App\Repositories\' . $model . 'Repository' — lop nay khong ton tai nen Laravel
 * loi 500; o day bo qua nhanh do (khong co ban dich san).
 */
export async function findMenuItemTranslate(menus: MenuRow[], languageId: bigint) {
  if (!menus.length) return [];
  const ids = menus.map((m) => m.id);
  const rows = await db.$queryRaw<{ menu_id: bigint; name: string; canonical: string | null }[]>`
    SELECT menu_id, name, canonical FROM menu_language WHERE language_id = ${languageId} AND menu_id IN (${Prisma.join(ids)})`;
  const map = new Map<string, { name: string; canonical: string | null }>();
  for (const r of rows) if (!map.has(r.menu_id.toString())) map.set(r.menu_id.toString(), r);
  return menus.map((m) => {
    const t = map.get(m.id.toString());
    return { ...m, translate_name: t ? t.name : null, translate_canonical: t ? t.canonical : null };
  });
}

/** MenuService::saveTranslateMenu */
export async function saveTranslateMenu(input: Input, languageId: bigint) {
  const translate = (phpClean(input.translate) ?? {}) as Record<string, unknown>;
  const list = (k: string) => {
    const v = translate[k];
    return Array.isArray(v) ? v : v && typeof v === "object" ? Object.values(v) : [];
  };
  const names = list("name");
  const canonicals = list("canonical");
  const ids = list("id");
  await db.$transaction(async (tx) => {
    for (let key = 0; key < names.length; key++) {
      const val = names[key];
      if (val === null || val === undefined) continue;
      const idStr = String(ids[key] ?? "").trim();
      if (!/^\d+$/.test(idStr)) continue;
      const menu = await tx.menus.findUnique({ where: { id: BigInt(idStr) } });
      if (!menu) continue;
      if (menu.deleted_at !== null) await tx.menus.update({ where: { id: menu.id }, data: { deleted_at: null, updated_at: now() } });
      await replacePivot(tx, menu.id, languageId, String(val), toNameOrNull(canonicals[key]));
    }
  });
}

/* --------------------------------- tien ich -------------------------------- */

/** addslashes() */
export function addslashes(s: string) {
  return s.replace(/([\\'"])/g, "\\$1").replace(/\0/g, "\\0");
}

/** Str::slug() (ASCII + dau tieng Viet, '@' -> 'at' nhu Laravel) */
export function strSlug(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/@/g, "-at-")
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]+/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
