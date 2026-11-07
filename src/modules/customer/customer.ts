import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { now } from "@/lib/helpers";
import type { Input } from "@/lib/http";
import { str } from "@/lib/http";
import { listParams, where, type SearchParams } from "@/server/admin-list";
import { hashPassword } from "@/modules/auth/routes";

/**
 * CustomerCatalogueService/Repository, CustomerService/Repository, SourceService/Repository
 * (app/Services/V1/Customer/*, app/Repositories/Customer/*).
 * Ca 3 model deu SoftDeletes.
 */

/** ConvertEmptyStringsToNull: input '' -> null; khong gui -> undefined (khong cap nhat). */
function nullable(input: Input, key: string): string | null | undefined {
  if (!(key in input)) return undefined;
  const v = str(input, key);
  return v === "" ? null : v;
}

/** PHP (int)/MySQL ep chuoi so khi ghi cot so. */
function toInt(v: string | null | undefined) {
  if (v === undefined) return undefined;
  if (v === null) return null;
  const n = Number.parseInt(v, 10);
  return Number.isNaN(n) ? 0 : n;
}

/* ============================ Nhom khach hang ============================ */

export type CustomerCatalogueRow = {
  id: bigint;
  name: string;
  description: string | null;
  point_percent: number;
  publish: number;
  customers_count: bigint;
};

/** CustomerCatalogueService::paginate — keyword name LIKE, withCount('customers'), id DESC. */
export async function paginateCustomerCatalogues(sp: SearchParams) {
  const { perPage, page, offset, keyword, publish } = listParams(sp);
  const cond = where([
    keyword ? Prisma.sql`cc.name LIKE ${`%${keyword}%`}` : null,
    publish ? Prisma.sql`cc.publish = ${publish}` : null,
    Prisma.sql`cc.deleted_at IS NULL`,
  ]);
  const [rows, count] = await Promise.all([
    db.$queryRaw<CustomerCatalogueRow[]>`
      SELECT cc.id, cc.name, cc.description, cc.point_percent, cc.publish,
             (SELECT COUNT(*) FROM customers WHERE customers.customer_catalogue_id = cc.id AND customers.deleted_at IS NULL) AS customers_count
      FROM customer_catalogues cc ${cond}
      ORDER BY cc.id DESC
      LIMIT ${perPage} OFFSET ${offset}`,
    db.$queryRaw<{ c: bigint }[]>`SELECT COUNT(*) AS c FROM customer_catalogues cc ${cond}`,
  ]);
  return { rows, total: Number(count[0].c), perPage, page };
}

export function findCustomerCatalogue(id: bigint) {
  return db.customer_catalogues.findFirst({ where: { id, deleted_at: null } });
}

export function allCustomerCatalogues() {
  return db.customer_catalogues.findMany({ where: { deleted_at: null }, orderBy: { id: "asc" } });
}

/** $request->except(['_token','send']) -> fill (fillable: name, description, publish, point_percent) */
function catalogueFields(input: Input) {
  const pp = nullable(input, "point_percent");
  const publish = nullable(input, "publish");
  return {
    name: nullable(input, "name") ?? undefined,
    description: nullable(input, "description"),
    // MySQL strict: NULL vao cot NOT NULL -> loi (giong ban goc)
    point_percent: pp === undefined ? undefined : (pp === null ? null : Number(pp)) as number,
    publish: toInt(publish) as number | undefined,
  };
}

export async function createCustomerCatalogue(input: Input) {
  const t = now();
  const data = catalogueFields(input);
  if (Number.isNaN(data.point_percent)) throw new Error("Incorrect decimal value for column 'point_percent'");
  await db.customer_catalogues.create({ data: { ...data, name: data.name as string, created_at: t, updated_at: t } });
}

export async function updateCustomerCatalogue(id: bigint, input: Input) {
  const found = await findCustomerCatalogue(id);
  if (!found) throw new Error(`No query results for model [App\\Models\\CustomerCatalogue] ${id}`);
  const data = catalogueFields(input);
  if (Number.isNaN(data.point_percent)) throw new Error("Incorrect decimal value for column 'point_percent'");
  await db.customer_catalogues.update({ where: { id }, data: { ...data, updated_at: now() } });
}

export async function destroyCustomerCatalogue(id: bigint) {
  const found = await findCustomerCatalogue(id);
  if (!found) throw new Error(`No query results for model [App\\Models\\CustomerCatalogue] ${id}`);
  await db.customer_catalogues.update({ where: { id }, data: { deleted_at: now() } });
}

/* ================================ Khach hang ================================ */

export type CustomerRow = {
  id: bigint;
  email: string | null;
  phone: string | null;
  address: string | null;
  name: string;
  publish: number;
  catalogue_name: string | null;
  source_name: string | null;
};

/**
 * CustomerRepository::customerPagination — keyword (name/email/address/phone), publish.
 * Khong co orderBy. with(['customer_catalogues','sources']) bo qua ban ghi da xoa mem.
 * Bo loc customer_catalogue_id tren giao dien khong duoc service su dung (giu nguyen).
 */
export async function paginateCustomers(sp: SearchParams) {
  const { perPage, page, offset, keyword, publish } = listParams(sp);
  const like = `%${keyword}%`;
  const cond = where([
    keyword
      ? Prisma.sql`(c.name LIKE ${like} OR c.email LIKE ${like} OR c.address LIKE ${like} OR c.phone LIKE ${like})`
      : null,
    publish ? Prisma.sql`c.publish = ${publish}` : null,
    Prisma.sql`c.deleted_at IS NULL`,
  ]);
  const [rows, count] = await Promise.all([
    db.$queryRaw<CustomerRow[]>`
      SELECT c.id, c.email, c.phone, c.address, c.name, c.publish, cc.name AS catalogue_name, s.name AS source_name
      FROM customers c
      LEFT JOIN customer_catalogues cc ON cc.id = c.customer_catalogue_id AND cc.deleted_at IS NULL
      LEFT JOIN sources s ON s.id = c.source_id AND s.deleted_at IS NULL
      ${cond}
      LIMIT ${perPage} OFFSET ${offset}`,
    db.$queryRaw<{ c: bigint }[]>`SELECT COUNT(*) AS c FROM customers c ${cond}`,
  ]);
  return { rows, total: Number(count[0].c), perPage, page };
}

export function findCustomer(id: bigint) {
  return db.customers.findFirst({ where: { id, deleted_at: null } });
}

/** Cac cot fillable cua model Customer (tru password xu ly rieng). */
const CUSTOMER_STRING_FIELDS = [
  "name",
  "google_id",
  "facebook_id",
  "email",
  "phone",
  "code",
  "province_id",
  "district_id",
  "ward_id",
  "address",
  "image",
  "description",
  "user_agent",
  "ip",
  "viettelpost_email",
  "viettelpost_password",
] as const;

function customerFields(input: Input) {
  const data: Record<string, unknown> = {};
  for (const k of CUSTOMER_STRING_FIELDS) {
    const v = nullable(input, k);
    if (v !== undefined) data[k] = v;
  }
  for (const k of ["customer_catalogue_id", "source_id"] as const) {
    const v = nullable(input, k);
    if (v !== undefined) data[k] = v === null ? null : BigInt(toInt(v) ?? 0);
  }
  const publish = nullable(input, "publish");
  if (publish !== undefined) data.publish = toInt(publish);
  // convertBirthdayDate: 'Y-m-d' -> 'Y-m-d H:i:s'
  const birthday = nullable(input, "birthday");
  if (birthday !== undefined) {
    if (birthday === null) data.birthday = null;
    else {
      const m = birthday.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
      if (!m) throw new Error(`Could not parse '${birthday}': Failed to parse time string`);
      data.birthday = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 0, 0, 0));
    }
  }
  return data;
}

/** CustomerService::create */
export async function createCustomer(input: Input) {
  const data = customerFields(input);
  if (data.customer_catalogue_id === undefined || data.customer_catalogue_id === null) {
    data.customer_catalogue_id = 1n;
    data.publish = 2;
  }
  data.password = await hashPassword(str(input, "password"));
  data.publish ??= 2; // $attributes = ['publish' => 2]
  const t = now();
  await db.customers.create({ data: { ...(data as Prisma.customersUncheckedCreateInput), created_at: t, updated_at: t } });
}

/** CustomerService::update — form admin khong gui new_password nen password giu nguyen. */
export async function updateCustomer(id: bigint, input: Input) {
  const found = await findCustomer(id);
  if (!found) throw new Error(`No query results for model [App\\Models\\Customer] ${id}`);
  const data = customerFields(input);
  const newPassword = nullable(input, "new_password");
  if (newPassword) data.password = await hashPassword(newPassword); // cast 'hashed'
  await db.customers.update({ where: { id }, data: { ...(data as Prisma.customersUncheckedUpdateInput), updated_at: now() } });
}

export async function destroyCustomer(id: bigint) {
  const found = await findCustomer(id);
  if (!found) throw new Error(`No query results for model [App\\Models\\Customer] ${id}`);
  await db.customers.update({ where: { id }, data: { deleted_at: now() } });
}

/** CustomerRepository::getCustomerByDate — whereBetween('created_at', [startDate, endDate]). */
export async function getCustomersByDate(start: string, end: string) {
  return db.$queryRaw<{ name: string; email: string | null; phone: string | null; address: string | null }[]>`
    SELECT name, email, phone, address FROM customers
    WHERE created_at BETWEEN ${start} AND ${end} AND deleted_at IS NULL`;
}

/** CustomerService::statistic */
export async function customerStatistic() {
  return { totalCustomers: await db.customers.count({ where: { deleted_at: null } }) };
}

/* ================================ Nguon khach ================================ */

/** SourceService::paginate — BaseRepository::pagination (keyword name, publish, id DESC). */
export async function paginateSources(sp: SearchParams) {
  const { perPage, page, offset, keyword, publish } = listParams(sp);
  const cond = where([
    keyword ? Prisma.sql`name LIKE ${`%${keyword}%`}` : null,
    publish ? Prisma.sql`publish = ${publish}` : null,
    Prisma.sql`deleted_at IS NULL`,
  ]);
  const [rows, count] = await Promise.all([
    db.$queryRaw<{ id: bigint; name: string; keyword: string; publish: number; description: string | null }[]>`
      SELECT id, name, keyword, publish, description FROM sources ${cond}
      ORDER BY id DESC LIMIT ${perPage} OFFSET ${offset}`,
    db.$queryRaw<{ c: bigint }[]>`SELECT COUNT(*) AS c FROM sources ${cond}`,
  ]);
  return { rows, total: Number(count[0].c), perPage, page };
}

export function findSource(id: bigint) {
  return db.sources.findFirst({ where: { id, deleted_at: null } });
}

export function allSources() {
  return db.sources.findMany({ where: { deleted_at: null }, orderBy: { id: "asc" } });
}

/** $request->only('name', 'keyword', 'description') */
function sourceFields(input: Input) {
  return {
    name: nullable(input, "name") as string,
    keyword: nullable(input, "keyword") as string,
    description: nullable(input, "description"),
  };
}

export async function createSource(input: Input) {
  const t = now();
  await db.sources.create({ data: { ...sourceFields(input), created_at: t, updated_at: t } });
}

export async function updateSource(id: bigint, input: Input) {
  const found = await findSource(id);
  if (!found) throw new Error(`No query results for model [App\\Models\\Source] ${id}`);
  await db.sources.update({ where: { id }, data: { ...sourceFields(input), updated_at: now() } });
}

export async function destroySource(id: bigint) {
  const found = await findSource(id);
  if (!found) throw new Error(`No query results for model [App\\Models\\Source] ${id}`);
  await db.sources.update({ where: { id }, data: { deleted_at: now() } });
}
