import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { now } from "@/lib/helpers";
import type { Input } from "@/lib/http";
import { listParams, where, type SearchParams } from "@/server/admin-list";
import { hashPassword } from "@/modules/auth/routes";
import { nullIfEmpty } from "@/modules/dashboard/ui";

/**
 * UserCatalogueService / UserService / PermissionService (app/Services/V1/User/*)
 * + cac Repository tuong ung (app/Repositories/User/*).
 */

// ---------------------------------------------------------------- UserCatalogue

export type UserCatalogueRow = {
  id: bigint;
  name: string;
  description: string | null;
  publish: number;
  users_count: bigint;
};

/** UserCatalogueService::paginate — relationCount(['users']), sap xep id DESC. */
export async function paginateUserCatalogues(sp: SearchParams) {
  const { perPage, page, offset, keyword, publish } = listParams(sp);
  const cond = where([
    keyword ? Prisma.sql`name LIKE ${`%${keyword}%`}` : null,
    publish ? Prisma.sql`publish = ${publish}` : null,
    Prisma.sql`user_catalogues.deleted_at IS NULL`,
  ]);
  const [rows, count] = await Promise.all([
    db.$queryRaw<UserCatalogueRow[]>`
      SELECT id, name, description, publish,
        (SELECT COUNT(*) FROM users WHERE users.user_catalogue_id = user_catalogues.id AND users.deleted_at IS NULL) AS users_count
      FROM user_catalogues ${cond}
      ORDER BY id DESC
      LIMIT ${perPage} OFFSET ${offset}`,
    db.$queryRaw<{ c: bigint }[]>`SELECT COUNT(*) AS c FROM user_catalogues ${cond}`,
  ]);
  return { rows, total: Number(count[0].c), perPage, page };
}

/** UserCatalogueRepository::findById (findOrFail, bo qua ban ghi da xoa mem). */
export async function findUserCatalogue(id: bigint) {
  return db.user_catalogues.findFirst({ where: { id, deleted_at: null } });
}

/** $request->except(['_token','send']) roi fill(): chi cac cot fillable name, description, publish. */
function userCatalogueFields(input: Input) {
  const out: Record<string, unknown> = {};
  if ("name" in input) out.name = nullIfEmpty(input.name);
  if ("description" in input) out.description = nullIfEmpty(input.description);
  if ("publish" in input) out.publish = Number.parseInt(String(input.publish ?? 0), 10) || 0;
  return out;
}

export async function createUserCatalogue(input: Input) {
  const t = now();
  return db.user_catalogues.create({
    data: { ...(userCatalogueFields(input) as { name: string }), created_at: t, updated_at: t },
  });
}

export async function updateUserCatalogue(id: bigint, input: Input) {
  const found = await findUserCatalogue(id);
  if (!found) throw new Error(`No query results for model [App\\Models\\UserCatalogue] ${id}`);
  await db.user_catalogues.update({ where: { id }, data: { ...userCatalogueFields(input), updated_at: now() } });
}

/** delete() voi SoftDeletes: chi gan deleted_at. */
export async function destroyUserCatalogue(id: bigint) {
  const found = await findUserCatalogue(id);
  if (!found) throw new Error(`No query results for model [App\\Models\\UserCatalogue] ${id}`);
  const t = now();
  await db.user_catalogues.update({ where: { id }, data: { deleted_at: t, updated_at: t } });
}

/** UserCatalogueController@permission: tat ca nhom (chua xoa) kem quyen + tat ca quyen. */
export async function permissionMatrix() {
  const [catalogues, permissions, pivot] = await Promise.all([
    db.user_catalogues.findMany({ where: { deleted_at: null }, orderBy: { id: "asc" } }),
    db.permissions.findMany({ orderBy: { id: "asc" } }),
    db.$queryRaw<{ user_catalogue_id: bigint; permission_id: bigint }[]>`SELECT user_catalogue_id, permission_id FROM user_catalogue_permission`,
  ]);
  const granted = new Set(pivot.map((p) => `${p.user_catalogue_id}-${p.permission_id}`));
  return { catalogues, permissions, granted };
}

/**
 * UserCatalogueService::setPermission: voi moi nhom co trong permission[...]:
 * detach() roi sync($val). Nhom khong gui len (bo tick het) thi giu nguyen — giong goc.
 */
export async function setPermission(input: Input) {
  const permission = input.permission;
  if (!permission || typeof permission !== "object") {
    // count(null) -> TypeError trong PHP 8 -> catch -> echo/die; o day bao loi
    throw new Error("count(): Argument #1 ($value) must be of type Countable|array, null given");
  }
  await db.$transaction(async (tx) => {
    for (const [key, val] of Object.entries(permission as Record<string, unknown>)) {
      const catalogue = await tx.user_catalogues.findFirst({ where: { id: BigInt(key), deleted_at: null } });
      if (!catalogue) throw new Error(`No query results for model [App\\Models\\UserCatalogue] ${key}`);
      const ids = [...new Set((Array.isArray(val) ? val : Object.values(val as object)).map(String))].filter((x) => /^\d+$/.test(x));
      await tx.$executeRaw`DELETE FROM user_catalogue_permission WHERE user_catalogue_id = ${catalogue.id}`;
      for (const pid of ids) {
        await tx.$executeRaw`INSERT INTO user_catalogue_permission (user_catalogue_id, permission_id) VALUES (${catalogue.id}, ${pid})`;
      }
    }
  });
}

// ---------------------------------------------------------------- User

export type UserRow = {
  id: bigint;
  email: string;
  phone: string | null;
  address: string | null;
  name: string;
  publish: number;
  user_catalogue_id: bigint;
  catalogue_name: string | null;
};

/**
 * UserRepository::userPagination. Dieu kien nam trong 1 nhom where():
 *   (name LIKE k OR email LIKE k OR address LIKE k OR phone LIKE k AND publish = p)
 * — AND uu tien hon OR, giu nguyen. Khong co orderBy.
 */
export async function paginateUsers(sp: SearchParams) {
  const { perPage, page, offset, keyword, publish } = listParams(sp);
  const parts: Prisma.Sql[] = [];
  if (keyword) {
    const k = `%${keyword}%`;
    parts.push(Prisma.sql`users.name LIKE ${k}`, Prisma.sql`users.email LIKE ${k}`, Prisma.sql`users.address LIKE ${k}`, Prisma.sql`users.phone LIKE ${k}`);
  }
  let group: Prisma.Sql | null = parts.length ? Prisma.join(parts, " OR ") : null;
  if (publish) group = group ? Prisma.sql`${group} AND users.publish = ${publish}` : Prisma.sql`users.publish = ${publish}`;
  const cond = where([group ? Prisma.sql`(${group})` : null, Prisma.sql`users.deleted_at IS NULL`]);
  const [rows, count] = await Promise.all([
    db.$queryRaw<UserRow[]>`
      SELECT users.id, users.email, users.phone, users.address, users.name, users.publish, users.user_catalogue_id,
        (SELECT uc.name FROM user_catalogues uc WHERE uc.id = users.user_catalogue_id AND uc.deleted_at IS NULL) AS catalogue_name
      FROM users ${cond}
      LIMIT ${perPage} OFFSET ${offset}`,
    db.$queryRaw<{ c: bigint }[]>`SELECT COUNT(*) AS c FROM users ${cond}`,
  ]);
  return { rows, total: Number(count[0].c), perPage, page };
}

export async function findUser(id: bigint) {
  return db.users.findFirst({ where: { id, deleted_at: null } });
}

/** Danh sach nhom thanh vien cho o chon (Blade goc viet cung 2 nhom id 1, 2). */
export async function userCatalogueOptions() {
  return db.user_catalogues.findMany({ where: { deleted_at: null }, select: { id: true, name: true }, orderBy: { id: "asc" } });
}

export async function provinces() {
  return db.provinces.findMany({ select: { code: true, name: true } });
}

/** UserService::convertBirthdayDate: 'Y-m-d' -> 'Y-m-d H:i:s' (gio hien tai, giong Carbon::createFromFormat). */
function birthday(v: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) throw new Error(`Unexpected data found. Trailing data`);
  const t = now();
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], t.getUTCHours(), t.getUTCMinutes(), t.getUTCSeconds()));
}

/** $request->except([...]) + fill() theo $fillable cua User. */
function userFields(input: Input) {
  const out: Record<string, unknown> = {};
  for (const k of ["name", "email", "phone", "province_id", "district_id", "ward_id", "address", "image", "description"]) {
    if (k in input) out[k] = nullIfEmpty(input[k]);
  }
  if ("user_catalogue_id" in input) out.user_catalogue_id = BigInt(Number.parseInt(String(input.user_catalogue_id ?? 0), 10) || 0);
  if ("publish" in input) out.publish = Number.parseInt(String(input.publish ?? 0), 10) || 0;
  if ("birthday" in input) {
    const b = nullIfEmpty(input.birthday);
    out.birthday = b === null ? null : birthday(b);
  }
  return out;
}

export async function createUser(input: Input) {
  const t = now();
  const data = userFields(input);
  data.password = await hashPassword(String(input.password ?? ""));
  return db.users.create({ data: { ...(data as Prisma.usersUncheckedCreateInput), created_at: t, updated_at: t } });
}

export async function updateUser(id: bigint, input: Input) {
  const found = await findUser(id);
  if (!found) throw new Error(`No query results for model [App\\Models\\User] ${id}`);
  await db.users.update({ where: { id }, data: { ...(userFields(input) as Prisma.usersUncheckedUpdateInput), updated_at: now() } });
}

export async function destroyUser(id: bigint) {
  const found = await findUser(id);
  if (!found) throw new Error(`No query results for model [App\\Models\\User] ${id}`);
  const t = now();
  await db.users.update({ where: { id }, data: { deleted_at: t, updated_at: t } });
}

// ---------------------------------------------------------------- Permission

/**
 * PermissionService::paginate. Bang permissions khong co cot publish: ban goc loc
 * publish>0 se loi SQL (500); o day bo qua dieu kien publish.
 */
export async function paginatePermissions(sp: SearchParams) {
  const { perPage, page, offset, keyword } = listParams(sp);
  const cond = where([keyword ? Prisma.sql`name LIKE ${`%${keyword}%`}` : null]);
  const [rows, count] = await Promise.all([
    db.$queryRaw<{ id: bigint; name: string; canonical: string }[]>`
      SELECT id, name, canonical FROM permissions ${cond} ORDER BY id DESC LIMIT ${perPage} OFFSET ${offset}`,
    db.$queryRaw<{ c: bigint }[]>`SELECT COUNT(*) AS c FROM permissions ${cond}`,
  ]);
  return { rows, total: Number(count[0].c), perPage, page };
}

export async function findPermission(id: bigint) {
  return db.permissions.findUnique({ where: { id } });
}

function permissionFields(input: Input) {
  const out: Record<string, unknown> = {};
  if ("name" in input) out.name = nullIfEmpty(input.name);
  if ("canonical" in input) out.canonical = nullIfEmpty(input.canonical);
  return out;
}

export async function createPermission(input: Input) {
  const t = now();
  return db.permissions.create({ data: { ...(permissionFields(input) as { name: string; canonical: string }), created_at: t, updated_at: t } });
}

export async function updatePermission(id: bigint, input: Input) {
  const found = await findPermission(id);
  if (!found) throw new Error(`No query results for model [App\\Models\\Permission] ${id}`);
  await db.permissions.update({ where: { id }, data: { ...permissionFields(input), updated_at: now() } });
}
