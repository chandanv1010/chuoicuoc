import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { now } from "@/lib/helpers";
import type { Input } from "@/lib/http";
import { slugify } from "@/lib/slug";
import { listParams, where, type SearchParams } from "@/server/admin-list";
import { nullIfEmpty } from "@/modules/dashboard/ui";

/**
 * LecturerService + LecturerRepository (app/Services/V1/Core/LecturerService.php).
 * Model Lecturer khong co SoftDeletes, khong orderBy khi phan trang.
 */
export type LecturerRow = {
  id: bigint;
  name: string;
  position: string;
  description: string | null;
  image: string | null;
  canonical: string | null;
  publish: number;
};

export async function paginateLecturers(sp: SearchParams) {
  const { perPage, page, offset, keyword, publish } = listParams(sp);
  const cond = where([keyword ? Prisma.sql`name LIKE ${`%${keyword}%`}` : null, publish ? Prisma.sql`publish = ${publish}` : null]);
  const [rows, count] = await Promise.all([
    db.$queryRaw<LecturerRow[]>`
      SELECT id, name, position, description, image, canonical, publish FROM lecturers ${cond} LIMIT ${perPage} OFFSET ${offset}`,
    db.$queryRaw<{ c: bigint }[]>`SELECT COUNT(*) AS c FROM lecturers ${cond}`,
  ]);
  return { rows, total: Number(count[0].c), perPage, page };
}

export async function findLecturer(id: bigint) {
  return db.lecturers.findUnique({ where: { id } });
}

/** $request->except(['_token','send']) + canonical = Str::slug(name). */
function lecturerFields(input: Input) {
  const out: Record<string, unknown> = {};
  for (const k of ["name", "position", "description", "image"]) if (k in input) out[k] = nullIfEmpty(input[k]);
  if ("publish" in input) out.publish = Number.parseInt(String(input.publish ?? 1), 10) || 1;
  out.canonical = slugify(String(input.name ?? ""));
  // name/position NOT NULL: o trong -> chuoi rong (tranh loi SQL)
  if (out.name === null) out.name = "";
  if (out.position === null) out.position = "";
  return out;
}

export async function createLecturer(input: Input) {
  const t = now();
  return db.lecturers.create({ data: { ...(lecturerFields(input) as { name: string; position: string }), created_at: t, updated_at: t } });
}

export async function updateLecturer(id: bigint, input: Input) {
  if (!(await findLecturer(id))) throw new Error(`No query results for model [App\\Models\\Lecturer] ${id}`);
  await db.lecturers.update({ where: { id }, data: { ...lecturerFields(input), updated_at: now() } });
}

/** delete() khong SoftDeletes -> xoa han. */
export async function destroyLecturer(id: bigint) {
  if (!(await findLecturer(id))) throw new Error(`No query results for model [App\\Models\\Lecturer] ${id}`);
  await db.lecturers.delete({ where: { id } });
}
