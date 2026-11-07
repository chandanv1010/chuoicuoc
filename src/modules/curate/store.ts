import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { now } from "@/lib/helpers";
import { fetchSource, type CurateItemInput, type CurateKind, type Provider, type SourceRow } from "./providers";

/** Bang curate_sources / curate_items (prisma/sql/2026-10-31-curate.sql). */

export type CurateSource = SourceRow & {
  interval_hours: number;
  active: number;
  last_run_at: Date | null;
  last_result: string | null;
};

export type CurateStatus = "new" | "approved" | "rejected" | "used";

export type CurateItem = Omit<CurateItemInput, "attribution_required" | "can_modify" | "can_republish"> & {
  id: bigint;
  source_id: bigint | null;
  attribution_required: number;
  can_modify: number;
  can_republish: number;
  status: CurateStatus;
  post_id: bigint | null;
  local_path: string | null;
  note: string | null;
  created_at: Date | null;
};

// cot INT tra ve bigint qua $queryRaw
const norm = (rows: CurateSource[]) => rows.map((r) => ({ ...r, per_run: Number(r.per_run), interval_hours: Number(r.interval_hours), active: Number(r.active) }));

export async function listSources() {
  return norm(await db.$queryRaw<CurateSource[]>`SELECT * FROM curate_sources ORDER BY id`);
}

export async function getSource(id: bigint) {
  return norm(await db.$queryRaw<CurateSource[]>`SELECT * FROM curate_sources WHERE id = ${id}`)[0] ?? null;
}

export type SourceInput = { provider: Provider; name: string; query: string; media: CurateKind; interval_hours: number; per_run: number; active: boolean };

export async function saveSource(id: bigint | null, s: SourceInput) {
  const t = now();
  if (id) {
    await db.$executeRaw`UPDATE curate_sources SET provider = ${s.provider}, name = ${s.name}, query = ${s.query}, media = ${s.media},
      interval_hours = ${s.interval_hours}, per_run = ${s.per_run}, active = ${s.active ? 1 : 0}, updated_at = ${t} WHERE id = ${id}`;
    return id;
  }
  await db.$executeRaw`INSERT INTO curate_sources (provider, name, query, media, interval_hours, per_run, active, created_at, updated_at)
    VALUES (${s.provider}, ${s.name}, ${s.query}, ${s.media}, ${s.interval_hours}, ${s.per_run}, ${s.active ? 1 : 0}, ${t}, ${t})`;
  return (await db.$queryRaw<{ id: bigint }[]>`SELECT LAST_INSERT_ID() AS id`)[0].id;
}

export async function deleteSource(id: bigint) {
  // muc da lay ve van giu (co the da dung), chi bo lien ket nguon
  await db.$executeRaw`UPDATE curate_items SET source_id = NULL WHERE source_id = ${id}`;
  return db.$executeRaw`DELETE FROM curate_sources WHERE id = ${id}`;
}

/** Ghi muc moi; trung (provider, external_id) thi bo qua de khong hoi lai muc admin da loai. */
async function insertItems(sourceId: bigint, items: CurateItemInput[]) {
  let added = 0;
  const t = now();
  for (const i of items) {
    added += await db.$executeRaw`INSERT IGNORE INTO curate_items
      (source_id, provider, external_id, kind, title, excerpt, page_url, media_url, thumb_url, width, height, duration, author, author_url,
       license, license_url, attribution, attribution_required, can_modify, can_republish, published_at, status, created_at, updated_at)
      VALUES (${sourceId}, ${i.provider}, ${i.external_id}, ${i.kind}, ${i.title}, ${i.excerpt}, ${i.page_url}, ${i.media_url}, ${i.thumb_url},
       ${i.width}, ${i.height}, ${i.duration}, ${i.author?.slice(0, 250) ?? null}, ${i.author_url}, ${i.license}, ${i.license_url},
       ${i.attribution.slice(0, 1000)}, ${i.attribution_required ? 1 : 0}, ${i.can_modify ? 1 : 0}, ${i.can_republish ? 1 : 0},
       ${i.published_at}, 'new', ${t}, ${t})`;
  }
  return added;
}

/** Chay mot nguon: lay ve, ghi muc moi, luu ket qua. */
export async function runSource(s: CurateSource) {
  const t = now();
  try {
    const items = await fetchSource(s);
    const added = await insertItems(s.id, items);
    const msg = `${added} mục mới / ${items.length} tìm thấy`;
    await db.$executeRaw`UPDATE curate_sources SET last_run_at = ${t}, last_result = ${msg} WHERE id = ${s.id}`;
    return { ok: true, added, found: items.length, message: msg };
  } catch (e) {
    const msg = `Lỗi: ${e instanceof Error ? e.message : String(e)}`.slice(0, 500);
    await db.$executeRaw`UPDATE curate_sources SET last_run_at = ${t}, last_result = ${msg} WHERE id = ${s.id}`;
    return { ok: false, added: 0, found: 0, message: msg };
  }
}

/** Nguon den han (active, chua chay hoac qua interval_hours). */
export async function dueSources() {
  const t = now();
  return norm(await db.$queryRaw<CurateSource[]>`SELECT * FROM curate_sources WHERE active = 1
    AND (last_run_at IS NULL OR last_run_at <= DATE_SUB(${t}, INTERVAL interval_hours HOUR)) ORDER BY last_run_at IS NULL DESC, last_run_at LIMIT 5`);
}

export type ItemFilter = { status?: string; kind?: string; provider?: string; q?: string; page?: number };
export const PER_PAGE = 24;

export async function paginateItems(f: ItemFilter) {
  const where = [
    f.status && f.status !== "all" ? Prisma.sql`status = ${f.status}` : f.status === "all" ? null : Prisma.sql`status = 'new'`,
    f.kind ? Prisma.sql`kind = ${f.kind}` : null,
    f.provider ? Prisma.sql`provider = ${f.provider}` : null,
    f.q ? Prisma.sql`(title LIKE ${`%${f.q}%`} OR author LIKE ${`%${f.q}%`})` : null,
  ].filter((x): x is Prisma.Sql => !!x);
  const w = where.length ? Prisma.sql`WHERE ${Prisma.join(where, " AND ")}` : Prisma.empty;
  const page = Math.max(1, f.page ?? 1);
  const [rows, total] = await Promise.all([
    db.$queryRaw<CurateItem[]>`SELECT * FROM curate_items ${w} ORDER BY id DESC LIMIT ${PER_PAGE} OFFSET ${(page - 1) * PER_PAGE}`.then((rows) =>
      rows.map((r) => ({ ...r, width: r.width && Number(r.width), height: r.height && Number(r.height), duration: r.duration && Number(r.duration) })),
    ),
    db.$queryRaw<{ n: bigint }[]>`SELECT COUNT(*) AS n FROM curate_items ${w}`,
  ]);
  return { rows, total: Number(total[0].n), page };
}

export async function countByStatus() {
  const rows = await db.$queryRaw<{ status: string; n: bigint }[]>`SELECT status, COUNT(*) AS n FROM curate_items GROUP BY status`;
  return Object.fromEntries(rows.map((r) => [r.status, Number(r.n)])) as Record<string, number>;
}

export async function getItem(id: bigint) {
  return (await db.$queryRaw<CurateItem[]>`SELECT * FROM curate_items WHERE id = ${id}`)[0] ?? null;
}

export async function setStatus(ids: bigint[], status: CurateStatus, userId: bigint) {
  if (!ids.length) return 0;
  const t = now();
  return db.$executeRaw`UPDATE curate_items SET status = ${status}, decided_by = ${userId}, decided_at = ${t}, updated_at = ${t}
    WHERE id IN (${Prisma.join(ids)}) AND status <> 'used'`;
}

export async function markUsed(id: bigint, postId: bigint, localPath: string | null, userId: bigint) {
  const t = now();
  return db.$executeRaw`UPDATE curate_items SET status = 'used', post_id = ${postId}, local_path = ${localPath}, decided_by = ${userId}, decided_at = ${t}, updated_at = ${t} WHERE id = ${id}`;
}
