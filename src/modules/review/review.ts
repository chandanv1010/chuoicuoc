import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { listParams, where, type SearchParams } from "@/server/admin-list";

/** ReviewService/ReviewRepository (app/Services/V1/Core/ReviewService.php) — model Review khong SoftDeletes. */

export type ReviewRow = {
  id: bigint;
  reviewable_id: number;
  reviewable_type: string;
  email: string;
  phone: string;
  fullname: string;
  gender: string;
  score: number;
  description: string;
  created_at: Date | null;
  status: number;
  image: string | null;
  canonical: string | null;
};

/** 'App\Models\Product' -> [products, product_language, product_id] */
function morphTables(type: string) {
  const m = type.match(/^App\\Models\\([A-Z][A-Za-z]+)$/);
  if (!m) return null;
  const snake = m[1].replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase();
  return { table: `${snake}s`, pivot: `${snake}_language`, fk: `${snake}_id` };
}

/**
 * ReviewService::paginate — keyword orWhere fullname/email/phone/description, id DESC.
 * Kem $review->reviewable->languages->first()->pivot->canonical (link doi tuong).
 */
export async function paginateReviews(sp: SearchParams) {
  const { perPage, page, offset, keyword } = listParams(sp);
  const like = `%${keyword}%`;
  const cond = where([
    keyword ? Prisma.sql`(fullname LIKE ${like} OR email LIKE ${like} OR phone LIKE ${like} OR description LIKE ${like})` : null,
  ]);
  const [rows, count] = await Promise.all([
    db.$queryRaw<ReviewRow[]>`
      SELECT id, reviewable_id, reviewable_type, email, phone, fullname, gender, score, description, created_at, status, image
      FROM reviews ${cond} ORDER BY id DESC LIMIT ${perPage} OFFSET ${offset}`,
    db.$queryRaw<{ c: bigint }[]>`SELECT COUNT(*) AS c FROM reviews ${cond}`,
  ]);
  for (const r of rows) {
    r.canonical = null;
    const t = morphTables(r.reviewable_type);
    if (!t) continue;
    try {
      const found = await db.$queryRawUnsafe<{ canonical: string | null }[]>(
        `SELECT p.canonical FROM \`${t.table}\` o
         INNER JOIN \`${t.pivot}\` p ON p.\`${t.fk}\` = o.id
         INNER JOIN languages l ON l.id = p.language_id
         WHERE o.id = ? AND o.deleted_at IS NULL LIMIT 1`,
        r.reviewable_id,
      );
      r.canonical = found[0]?.canonical ?? null;
    } catch {
      r.canonical = null; // ban goc: doi tuong khong ton tai -> loi 500
    }
  }
  return { rows, total: Number(count[0].c), perPage, page };
}

export function findReview(id: bigint) {
  return db.reviews.findUnique({ where: { id } });
}

/** ReviewService::destroy — xoa cung (model khong SoftDeletes). */
export async function destroyReview(id: bigint) {
  const found = await findReview(id);
  if (!found) throw new Error(`No query results for model [App\\Models\\Review] ${id}`);
  await db.reviews.delete({ where: { id } });
}
