import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { now } from "@/lib/helpers";
import type { Input } from "@/lib/http";
import { intParam, listParams, param, where, type SearchParams } from "@/server/admin-list";
import { inputOf, phpInteger } from "@/modules/slide/php";

/**
 * HomeFeatureRepository + HomeFeatureService (app/Services/V1/Home/HomeFeatureService.php)
 * + hang so HomeFeature::NHOM. Bang khong co deleted_at -> xoa han.
 */
export const NHOM: Record<string, string> = {
  hero_usp: "Điểm mạnh dưới banner (4 mục)",
  commit: "Dải cam kết (5 mục)",
  about_badge: "Huy hiệu khối giới thiệu (3 mục)",
  why_waco: "Vì sao chọn WACO (6 mục)",
  stat: "Số liệu mạng lưới đại lý (4 mục)",
};

export const tenNhom = (group: string) => NHOM[group] ?? group;

export type FeatureRow = {
  id: bigint;
  group: string;
  title: string;
  description: string | null;
  value: string | null;
  icon: string | null;
  post_id: bigint | null;
  order: number;
  publish: number;
};

const columns = async () => Prisma.raw("id, `group`, title, description, value, icon, post_id, `order`, publish");

/** HomeFeatureService::paginate -> HomeFeatureRepository::phanTrang (order by group, order) */
export async function paginateFeatures(sp: SearchParams) {
  const n = intParam(sp, "perpage");
  const perPage = n > 0 ? n : 50;
  const { page } = listParams(sp);
  const offset = (page - 1) * perPage;
  const keyword = (param(sp, "keyword") ?? "").trim();
  const group = param(sp, "group");
  const publish = intParam(sp, "publish");
  const cond = where([
    keyword !== "" ? Prisma.sql`title LIKE ${`%${keyword}%`}` : null,
    group ? Prisma.sql`\`group\` = ${group}` : null,
    publish ? Prisma.sql`publish = ${publish}` : null,
  ]);
  const [rows, count] = await Promise.all([
    db.$queryRaw<FeatureRow[]>`SELECT ${await columns()} FROM home_features ${cond} ORDER BY \`group\` ASC, \`order\` ASC LIMIT ${perPage} OFFSET ${offset}`,
    db.$queryRaw<{ c: bigint }[]>`SELECT COUNT(*) AS c FROM home_features ${cond}`,
  ]);
  return { rows, total: Number(count[0].c), perPage, page };
}

/** HomeFeatureRepository::demTheoNhom */
export async function demTheoNhom() {
  const rows = await db.$queryRaw<{ nhom: string; so_dong: bigint }[]>`
    SELECT \`group\` AS nhom, COUNT(*) AS so_dong FROM home_features WHERE publish = 2 GROUP BY \`group\``;
  return Object.fromEntries(rows.map((r) => [r.nhom, Number(r.so_dong)])) as Record<string, number>;
}

export async function findFeature(id: bigint) {
  const rows = await db.$queryRaw<FeatureRow[]>`SELECT ${await columns()} FROM home_features WHERE id = ${id} LIMIT 1`;
  return rows[0] ?? null;
}

/** HomeFeatureController::danhSachBaiViet: bai dang hien thi, moi nhat truoc -> [[id, ten]] */
export async function danhSachBaiViet(languageId: bigint) {
  const rows = await db.$queryRaw<{ id: bigint; name: string }[]>`
    SELECT posts.id, pl.name FROM posts
    JOIN post_language AS pl ON pl.post_id = posts.id AND pl.language_id = ${languageId}
    WHERE posts.publish = 2 AND posts.deleted_at IS NULL
    ORDER BY posts.id DESC`;
  // pluck('pl.name', 'posts.id'): trung id thi gia tri sau ghi de, giu vi tri xuat hien dau
  const map = new Map<string, string>();
  for (const r of rows) map.set(r.id.toString(), r.name);
  return [...map.entries()];
}

/** HomeFeatureService::duLieu */
async function duLieu(input: Input) {
  const data: Record<string, unknown> = {
    group: inputOf(input, "group"),
    title: inputOf(input, "title"),
    description: inputOf(input, "description"),
    value: inputOf(input, "value"),
    icon: inputOf(input, "icon"),
    order: phpInteger(input, "order"),
    publish: phpInteger(input, "publish") || 2,
  };
  // $request->input('post_id') ?: null
  const p = inputOf(input, "post_id");
  data.post_id = p && p !== "0" ? BigInt(p) : null;
  return data;
}

export async function createFeature(input: Input) {
  const d = await duLieu(input);
  const t = now();
  const cols = Object.keys(d);
  await db.$executeRawUnsafe(
    `INSERT INTO home_features (${cols.map((c) => `\`${c}\``).join(", ")}, created_at, updated_at) VALUES (${cols.map(() => "?").join(", ")}, ?, ?)`,
    ...cols.map((c) => d[c]),
    t,
    t,
  );
}

export async function updateFeature(id: bigint, input: Input) {
  const cur = await findFeature(id);
  if (!cur) throw new Error("ModelNotFound");
  const d = await duLieu(input);
  // fill + save: chi ghi cot thay doi (updated_at chi doi khi co thay doi)
  const dirty = Object.entries(d).filter(([k, v]) => {
    const old = (cur as Record<string, unknown>)[k];
    return (old === null) !== (v === null) || String(old ?? "") !== String(v ?? "");
  });
  if (!dirty.length) return;
  await db.$executeRawUnsafe(
    `UPDATE home_features SET ${dirty.map(([k]) => `\`${k}\` = ?`).join(", ")}, updated_at = ? WHERE id = ?`,
    ...dirty.map(([, v]) => v),
    now(),
    id,
  );
}

export async function destroyFeature(id: bigint) {
  const n = await db.$executeRaw`DELETE FROM home_features WHERE id = ${id}`;
  if (!n) throw new Error("ModelNotFound");
}
