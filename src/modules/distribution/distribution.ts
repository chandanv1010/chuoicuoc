import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { now } from "@/lib/helpers";
import type { Input } from "@/lib/http";
import { intParam, listParams, param, where, type SearchParams } from "@/server/admin-list";
import { inputOf } from "@/modules/slide/php";
import { addslashes } from "@/modules/menu/menu";

/**
 * DistributionRepository/Service + DistributionAreaRepository/Service
 * (app/Services/V1/Core/Distribution*Service.php, app/Repositories/Core/Distribution*Repository.php).
 * distributions: xoa mem; distribution_areas: khong co deleted_at (xoa han).
 */

/** $request->integer('perpage') > 0 ? ... : 20 */
function perPage20(sp: SearchParams) {
  const n = intParam(sp, "perpage");
  return n > 0 ? n : 20;
}

/* ------------------------------ distributions ----------------------------- */

export type DistributionRow = {
  id: bigint;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  image: string | null;
  map: string | null;
  province_id: bigint | null;
  district_id: bigint | null;
  publish: number;
  region_name: string | null;
  area_name: string | null;
};

/**
 * DistributionService::paginate -> DistributionRepository::distributionPagination.
 * Giu nguyen nhom where long nhau cua ban goc: (name LIKE OR phone LIKE OR address LIKE AND publish = ? ...).
 */
export async function paginateDistributions(sp: SearchParams) {
  const perPage = perPage20(sp);
  const { page } = listParams(sp);
  const offset = (page - 1) * perPage;
  const keyword = addslashes((param(sp, "keyword") ?? "").trim());
  const publish = intParam(sp, "publish");
  const provinceId = intParam(sp, "province_id");
  const districtId = intParam(sp, "district_id");

  const inner: Prisma.Sql[] = [];
  if (keyword) inner.push(Prisma.sql`d.name LIKE ${`%${keyword}%`} OR d.phone LIKE ${`%${keyword}%`} OR d.address LIKE ${`%${keyword}%`}`);
  if (publish !== 0) inner.push(Prisma.sql`d.publish = ${publish}`);
  if (provinceId !== 0) inner.push(Prisma.sql`d.province_id = ${provinceId}`);
  if (districtId !== 0) inner.push(Prisma.sql`d.district_id = ${districtId}`);
  const cond = where([inner.length ? Prisma.sql`(${Prisma.join(inner, " AND ")})` : null, Prisma.sql`d.deleted_at IS NULL`]);

  const [rows, count] = await Promise.all([
    db.$queryRaw<DistributionRow[]>`
      SELECT d.id, d.name, d.phone, d.email, d.address, d.image, d.map, d.province_id, d.district_id, d.publish,
             r.name AS region_name, a.name AS area_name
      FROM distributions d
      LEFT JOIN distribution_areas r ON r.id = d.province_id
      LEFT JOIN distribution_areas a ON a.id = d.district_id
      ${cond} ORDER BY d.id DESC LIMIT ${perPage} OFFSET ${offset}`,
    db.$queryRaw<{ c: bigint }[]>`SELECT COUNT(*) AS c FROM distributions d ${cond}`,
  ]);
  return { rows, total: Number(count[0].c), perPage, page };
}

/** DistributionRepository::findById (findOrFail, bo xoa mem) */
export function findDistribution(id: bigint) {
  return db.distributions.findFirst({ where: { id, deleted_at: null } });
}

/** $request->except(['_token','send']) loc qua $fillable */
function distributionPayload(input: Input) {
  const data: Record<string, unknown> = {};
  for (const k of ["name", "phone", "email", "address", "image", "map"]) if (k in input) data[k] = inputOf(input, k);
  for (const k of ["province_id", "district_id", "publish"]) {
    if (!(k in input)) continue;
    const v = inputOf(input, k);
    data[k] = v === null ? null : k === "publish" ? Number.parseInt(v, 10) : BigInt(Number.parseInt(v, 10) || 0);
  }
  return data;
}

export async function createDistribution(input: Input) {
  const t = now();
  await db.distributions.create({ data: { ...(distributionPayload(input) as Prisma.distributionsCreateInput), created_at: t, updated_at: t } });
}

export async function updateDistribution(id: bigint, input: Input) {
  const cur = await findDistribution(id);
  if (!cur) throw new Error("ModelNotFound");
  const data = distributionPayload(input);
  const dirty = Object.fromEntries(Object.entries(data).filter(([k, v]) => String((cur as Record<string, unknown>)[k] ?? "\u0000") !== String(v ?? "\u0000")));
  if (Object.keys(dirty).length) await db.distributions.update({ where: { id }, data: { ...dirty, updated_at: now() } });
}

export async function destroyDistribution(id: bigint) {
  const r = await db.distributions.updateMany({ where: { id, deleted_at: null }, data: { deleted_at: now() } });
  if (!r.count) throw new Error("ModelNotFound");
}

/* --------------------------- distribution_areas --------------------------- */

/** DistributionAreaRepository::findAreaByParentId: parent_id = ? AND publish = 2 */
export function findAreaByParentId(parentId: bigint | number) {
  return db.$queryRaw<{ id: bigint; name: string; parent_id: bigint; publish: number; created_at: Date | null; updated_at: Date | null }[]>`
    SELECT id, name, parent_id, publish, created_at, updated_at FROM distribution_areas WHERE parent_id = ${parentId} AND publish = 2`;
}

/** DistributionAreaService::paginate (scope keyword + customWhere name LIKE trung nhau nhu ban goc) */
export async function paginateAreas(sp: SearchParams) {
  const perPage = perPage20(sp);
  const { page } = listParams(sp);
  const offset = (page - 1) * perPage;
  const keyword = addslashes((param(sp, "keyword") ?? "").trim());
  const publish = intParam(sp, "publish");
  const cond = where([
    keyword ? Prisma.sql`a.name LIKE ${`%${keyword}%`}` : null,
    publish ? Prisma.sql`a.publish = ${publish}` : null,
    keyword ? Prisma.sql`a.name LIKE ${`%${keyword}%`}` : null,
    publish !== 0 ? Prisma.sql`a.publish = ${publish}` : null,
  ]);
  const [rows, count] = await Promise.all([
    db.$queryRaw<{ id: bigint; name: string; parent_id: bigint; publish: number; parent_name: string | null }[]>`
      SELECT a.id, a.name, a.parent_id, a.publish, p.name AS parent_name
      FROM distribution_areas a LEFT JOIN distribution_areas p ON p.id = a.parent_id
      ${cond} ORDER BY a.id DESC LIMIT ${perPage} OFFSET ${offset}`,
    db.$queryRaw<{ c: bigint }[]>`SELECT COUNT(*) AS c FROM distribution_areas a ${cond}`,
  ]);
  return { rows, total: Number(count[0].c), perPage, page };
}

export function findArea(id: bigint) {
  return db.distribution_areas.findUnique({ where: { id } });
}

function areaPayload(input: Input) {
  const data: Record<string, unknown> = {};
  if ("name" in input) data.name = inputOf(input, "name");
  if ("parent_id" in input) data.parent_id = BigInt(Number.parseInt(inputOf(input, "parent_id") ?? "0", 10) || 0);
  if ("publish" in input) {
    const v = inputOf(input, "publish");
    data.publish = v === null ? null : Number.parseInt(v, 10);
  }
  return data;
}

export async function createArea(input: Input) {
  const t = now();
  await db.distribution_areas.create({ data: { ...(areaPayload(input) as Prisma.distribution_areasCreateInput), created_at: t, updated_at: t } });
}

export async function updateArea(id: bigint, input: Input) {
  const cur = await findArea(id);
  if (!cur) throw new Error("ModelNotFound");
  const data = areaPayload(input);
  const dirty = Object.fromEntries(Object.entries(data).filter(([k, v]) => String((cur as Record<string, unknown>)[k] ?? "\u0000") !== String(v ?? "\u0000")));
  if (Object.keys(dirty).length) await db.distribution_areas.update({ where: { id }, data: { ...dirty, updated_at: now() } });
}

export async function destroyArea(id: bigint) {
  await db.distribution_areas.delete({ where: { id } });
}

/** Model::toJSON cua Carbon (timezone Asia/Ho_Chi_Minh -> UTC, 6 chu so micro giay) */
export function carbonJson(d: Date | null) {
  if (!d) return null;
  const utc = new Date(d.getTime() - 7 * 3600 * 1000);
  return utc.toISOString().replace(/\.(\d{3})Z$/, ".$1000Z");
}
