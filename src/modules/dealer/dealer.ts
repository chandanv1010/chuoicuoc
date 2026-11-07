import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { now } from "@/lib/helpers";
import type { Input } from "@/lib/http";
import { intParam, listParams, param, where, type SearchParams } from "@/server/admin-list";
import { inputOf, phpInteger } from "@/modules/slide/php";
import { addslashes } from "@/modules/menu/menu";

/**
 * DealerRepository/DealerService + DealerRegistrationRepository/Service
 * (app/Services/V1/Dealer/*.php) + hang so Dealer::LOAI, DealerRegistration::TRANG_THAI.
 */
export const LOAI: Record<string, string> = {
  dealer: "Đại lý",
  distributor: "Nhà phân phối",
  service: "Trung tâm bảo hành",
  showroom: "Showroom",
};
export const tenLoai = (type: string) => LOAI[type] ?? type;

export const TRANG_THAI: Record<string, string> = {
  new: "Mới gửi",
  contacted: "Đã liên hệ",
  working: "Đang trao đổi",
  done: "Đã chốt",
  cancelled: "Không phù hợp",
};
const MAU_TRANG_THAI: Record<string, string> = { new: "danger", contacted: "warning", working: "primary", done: "success", cancelled: "default" };
export const tenTrangThai = (s: string) => TRANG_THAI[s] ?? s;
export const mauTrangThai = (s: string) => MAU_TRANG_THAI[s] ?? "default";

/* --------------------------------- dealers -------------------------------- */

export type DealerRow = {
  id: bigint;
  name: string;
  address: string | null;
  phone: string | null;
  province_code: string | null;
  district_code: string | null;
  ward_code: string | null;
  latitude: string | null;
  longitude: string | null;
  type: string;
  is_featured: number;
  publish: number;
  order: number;
  province_name: string | null;
};

/** Province::select('code','name')->orderBy('name') */
export function danhSachTinh() {
  return db.$queryRaw<{ code: string; name: string }[]>`SELECT code, name FROM provinces ORDER BY name ASC`;
}

/**
 * DealerService::paginate -> BaseRepository::pagination (order ASC).
 * Ban goc khong select latitude/longitude nen cot "Toa do" trong danh sach luon "Chua co" (giu nguyen).
 */
export async function paginateDealers(sp: SearchParams) {
  const n = intParam(sp, "perpage");
  const perPage = n > 0 ? n : 20;
  const { page } = listParams(sp);
  const offset = (page - 1) * perPage;
  const keyword = addslashes((param(sp, "keyword") ?? "").trim());
  const publish = intParam(sp, "publish");
  const provinceCode = (param(sp, "province_code") ?? "").trim();
  const type = (param(sp, "type") ?? "").trim();
  const cond = where([
    keyword ? Prisma.sql`d.name LIKE ${`%${keyword}%`}` : null,
    publish ? Prisma.sql`d.publish = ${publish}` : null,
    provinceCode && provinceCode !== "0" ? Prisma.sql`d.province_code = ${provinceCode}` : null,
    type && type !== "0" ? Prisma.sql`d.type = ${type}` : null,
    Prisma.sql`d.deleted_at IS NULL`,
  ]);
  const [rows, count] = await Promise.all([
    db.$queryRaw<DealerRow[]>`
      SELECT d.id, d.name, d.address, d.phone, d.province_code, NULL AS district_code, NULL AS ward_code,
             NULL AS latitude, NULL AS longitude, d.type, d.is_featured, d.publish, d.\`order\`, p.name AS province_name
      FROM dealers d LEFT JOIN provinces p ON p.code = d.province_code
      ${cond} ORDER BY d.\`order\` ASC LIMIT ${perPage} OFFSET ${offset}`,
    db.$queryRaw<{ c: bigint }[]>`SELECT COUNT(*) AS c FROM dealers d ${cond}`,
  ]);
  return { rows, total: Number(count[0].c), perPage, page };
}

/** DealerRepository::findById (findOrFail, bo xoa mem). Toa do doc dang chuoi nhu PDO ("21.0278000"). */
export async function findDealer(id: bigint) {
  const rows = await db.$queryRaw<DealerRow[]>`
    SELECT d.id, d.name, d.address, d.phone, d.province_code, d.district_code, d.ward_code,
           CAST(d.latitude AS CHAR) AS latitude, CAST(d.longitude AS CHAR) AS longitude,
           d.type, d.is_featured, d.publish, d.\`order\`, NULL AS province_name
    FROM dealers d WHERE d.id = ${id} AND d.deleted_at IS NULL LIMIT 1`;
  return rows[0] ?? null;
}

/** $request->boolean() */
function phpBoolean(v: unknown) {
  return ["1", "true", "on", "yes"].includes(String(v ?? "").trim().toLowerCase());
}

/** DealerService::duLieu */
async function duLieu(input: Input) {
  const lat = String(inputOf(input, "latitude") ?? "").trim();
  const lng = String(inputOf(input, "longitude") ?? "").trim();
  const data: [string, unknown][] = [
    ["name", inputOf(input, "name")],
    ["address", inputOf(input, "address")],
    ["phone", inputOf(input, "phone")],
  ];
  for (const col of ["province_code", "district_code", "ward_code"] as const) {
    const v = inputOf(input, col);
    data.push([col, v || null]); // $request->input(x) ?: null
  }
  data.push(
    ["latitude", lat === "" ? null : lat],
    ["longitude", lng === "" ? null : lng],
    ["type", inputOf(input, "type") || "dealer"],
    ["is_featured", phpBoolean(input.is_featured) ? 1 : 0],
    ["order", phpInteger(input, "order")],
    ["publish", phpInteger(input, "publish") || 2],
  );
  return data;
}

export async function createDealer(input: Input) {
  const data = await duLieu(input);
  const t = now();
  await db.$executeRawUnsafe(
    `INSERT INTO dealers (${data.map(([k]) => `\`${k}\``).join(", ")}, created_at, updated_at) VALUES (${data.map(() => "?").join(", ")}, ?, ?)`,
    ...data.map(([, v]) => v),
    t,
    t,
  );
}

export async function updateDealer(id: bigint, input: Input) {
  const cur = await db.$queryRawUnsafe<Record<string, unknown>[]>(
    "SELECT *, CAST(latitude AS CHAR) AS lat_s, CAST(longitude AS CHAR) AS lng_s FROM dealers WHERE id = ? AND deleted_at IS NULL",
    id,
  );
  if (!cur.length) throw new Error("ModelNotFound");
  const row = cur[0];
  const data = await duLieu(input);
  // fill + save: chi ghi cot thay doi
  const dirty = data.filter(([k, v]) => {
    const old = k === "latitude" ? row.lat_s : k === "longitude" ? row.lng_s : row[k];
    if ((old === null || old === undefined) !== (v === null)) return true;
    if (k === "latitude" || k === "longitude") return v !== null && Number(old) !== Number(v);
    return String(old ?? "") !== String(v ?? "");
  });
  if (!dirty.length) return;
  await db.$executeRawUnsafe(
    `UPDATE dealers SET ${dirty.map(([k]) => `\`${k}\` = ?`).join(", ")}, updated_at = ? WHERE id = ?`,
    ...dirty.map(([, v]) => v),
    now(),
    id,
  );
}

export async function destroyDealer(id: bigint) {
  const n = await db.$executeRaw`UPDATE dealers SET deleted_at = ${now()} WHERE id = ${id} AND deleted_at IS NULL`;
  if (!n) throw new Error("ModelNotFound");
}

/* --------------------------- dealer_registrations -------------------------- */

/** DealerRegistrationService::paginate -> DealerRegistrationRepository::phanTrang */
export async function paginateRegistrations(sp: SearchParams) {
  const n = intParam(sp, "perpage");
  const perPage = n > 0 ? n : 20;
  const { page } = listParams(sp);
  const offset = (page - 1) * perPage;
  const keyword = (param(sp, "keyword") ?? "").trim();
  const statusRaw = (param(sp, "status") ?? "").trim();
  const status = statusRaw in TRANG_THAI ? statusRaw : null;
  const cond = where([
    keyword ? Prisma.sql`(name LIKE ${`%${keyword}%`} OR phone LIKE ${`%${keyword}%`} OR company LIKE ${`%${keyword}%`})` : null,
    status ? Prisma.sql`status = ${status}` : null,
    Prisma.sql`deleted_at IS NULL`,
  ]);
  const [rows, count] = await Promise.all([
    db.$queryRaw<
      { id: bigint; name: string; phone: string; company: string | null; business_area: string | null; note: string | null; status: string; created_at: Date | null }[]
    >`SELECT id, name, phone, company, business_area, note, status, created_at FROM dealer_registrations ${cond} ORDER BY id DESC LIMIT ${perPage} OFFSET ${offset}`,
    db.$queryRaw<{ c: bigint }[]>`SELECT COUNT(*) AS c FROM dealer_registrations ${cond}`,
  ]);
  return { rows, total: Number(count[0].c), perPage, page };
}

/** DealerRegistrationRepository::demTheoTrangThai */
export async function demTheoTrangThai() {
  const rows = await db.$queryRaw<{ status: string; so_don: bigint }[]>`
    SELECT status, COUNT(*) AS so_don FROM dealer_registrations WHERE deleted_at IS NULL GROUP BY status`;
  return Object.fromEntries(rows.map((r) => [r.status, Number(r.so_don)])) as Record<string, number>;
}

export function findRegistration(id: bigint) {
  return db.dealer_registrations.findFirst({ where: { id, deleted_at: null } });
}

/** DealerRegistrationService::update: chi doi status + note */
export async function updateRegistration(id: bigint, input: Input) {
  const cur = await findRegistration(id);
  if (!cur) throw new Error("ModelNotFound");
  const status = inputOf(input, "status") ?? "";
  const note = inputOf(input, "note");
  if (cur.status === status && cur.note === note) return;
  await db.dealer_registrations.update({ where: { id }, data: { status, note, updated_at: now() } });
}

export async function destroyRegistration(id: bigint) {
  const r = await db.dealer_registrations.updateMany({ where: { id, deleted_at: null }, data: { deleted_at: now() } });
  if (!r.count) throw new Error("ModelNotFound");
}

/** $date->format('H:i d/m/Y') (gio dia phuong luu trong DB) */
export function formatHiDmy(d: Date | null) {
  if (!d) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getUTCHours())}:${p(d.getUTCMinutes())} ${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}
