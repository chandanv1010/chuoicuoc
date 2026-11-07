import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { now } from "@/lib/helpers";
import { listParams, where, type SearchParams } from "@/server/admin-list";

/** ContactService/ContactRepository (app/Services/V1/Core/ContactService.php) — SoftDeletes. */

export type ContactRow = {
  id: bigint;
  name: string | null;
  address: string | null;
  phone: string | null;
  created_at: Date | null;
  message: string | null;
};

/** ContactService::paginate — BaseRepository::pagination (keyword name LIKE, id DESC). */
export async function paginateContacts(sp: SearchParams) {
  const { perPage, page, offset, keyword, publish } = listParams(sp);
  const cond = where([
    keyword ? Prisma.sql`name LIKE ${`%${keyword}%`}` : null,
    publish ? Prisma.sql`publish = ${publish}` : null,
    Prisma.sql`deleted_at IS NULL`,
  ]);
  const [rows, count] = await Promise.all([
    db.$queryRaw<ContactRow[]>`
      SELECT id, name, address, phone, created_at, message FROM contacts ${cond}
      ORDER BY id DESC LIMIT ${perPage} OFFSET ${offset}`,
    db.$queryRaw<{ c: bigint }[]>`SELECT COUNT(*) AS c FROM contacts ${cond}`,
  ]);
  return { rows, total: Number(count[0].c), perPage, page };
}

export function findContact(id: bigint) {
  return db.contacts.findFirst({ where: { id, deleted_at: null } });
}

export async function destroyContact(id: bigint) {
  const found = await findContact(id);
  if (!found) throw new Error(`No query results for model [App\\Models\\Contact] ${id}`);
  await db.contacts.update({ where: { id }, data: { deleted_at: now() } });
}
