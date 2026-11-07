import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";
import { siteName } from "@/lib/site";
import { parseDoc, partKindOf, PAGE_KIND_LABEL, type BuilderDoc, type PageKind, type PartKind } from "./schema";
import { defaultDoc } from "./seed";

/**
 * Bang builder_pages (prisma/sql/2026-10-30-builder-pages.sql). Slug:
 *  - home / header / footer: trang chu va phan chung moi trang
 *  - tpl-<loai>: template cho moi trang con cung loai (product, catalogue, post, postcat)
 *  - <loai>-<id>: thiet ke rieng cho mot trang con (vd. product-123) — uu tien hon template
 *  - lp-<duong-dan>: landing page tu tao, hien o /<duong-dan>.html
 *  - header-<ten> / footer-<ten>: header / footer thiet ke rieng, trang chon dung trong "Cài đặt trang"
 */

export const BUILDER_PAGES: Record<string, string> = { home: "Trang chủ", header: "Header (mọi trang)", footer: "Footer (mọi trang)" };
export const PAGE_KINDS: PageKind[] = ["product", "catalogue", "post", "postcat"];
export const templateSlug = (kind: PageKind) => `tpl-${kind}`;
/** Duong dan landing page (khong gom .html) */
export const LANDING_PATH = /^[a-z0-9][a-z0-9-]{0,98}$/;
export const landingSlug = (path: string) => `lp-${path}`;
/** Phan chung cua trang (header / footer, ca ban thiet ke rieng): canvas hien rieng, khong boc trong header / footer. */
export const isPartSlug = (slug: string) => !!partKindOf(slug);

export type PageInfo = { slug: string; title: string; kind: PageKind | null; recordId: number | null; landing?: string; part?: PartKind };

/** Thong tin trang tu slug; null = slug khong hop le. (Ten that cua landing / header rieng nam trong bang.) */
export function pageInfo(slug: string): PageInfo | null {
  if (slug in BUILDER_PAGES) return { slug, title: BUILDER_PAGES[slug], kind: null, recordId: null, part: partKindOf(slug) ?? undefined };
  const part = partKindOf(slug);
  if (part) return { slug, title: `${part === "header" ? "Header" : "Footer"} riêng · ${slug.slice(part.length + 1)}`, kind: null, recordId: null, part };
  const lp = slug.match(/^lp-(.+)$/);
  if (lp && LANDING_PATH.test(lp[1])) return { slug, title: `Landing · /${lp[1]}.html`, kind: null, recordId: null, landing: lp[1] };
  const t = slug.match(/^tpl-(product|catalogue|post|postcat)$/);
  if (t) return { slug, title: `Template · ${PAGE_KIND_LABEL[t[1] as PageKind]}`, kind: t[1] as PageKind, recordId: null };
  const o = slug.match(/^(product|catalogue|post|postcat)-(\d{1,12})$/);
  if (o) return { slug, title: `Thiết kế riêng · ${PAGE_KIND_LABEL[o[1] as PageKind]} #${o[2]}`, kind: o[1] as PageKind, recordId: Number(o[2]) };
  return null;
}

type Row = { id: bigint; slug: string; title: string; draft: string; published: string | null; published_at: Date | null; updated_at: Date | null };

const getRow = cache(async (slug: string) => {
  const [row] = await db.$queryRaw<Row[]>`SELECT * FROM builder_pages WHERE slug = ${slug} LIMIT 1`;
  return row ?? null;
});

/** Ban dang hien tren storefront; null = chua xuat ban (trang van dung giao dien code cung). */
export async function getPublishedDoc(slug: string): Promise<BuilderDoc | null> {
  const row = await getRow(slug);
  return row?.published ? parseDoc(row.published) : null;
}

/** Trang con dang xem: thiet ke rieng (neu da xuat ban) roi moi den template cua loai do. */
export async function getPageDoc(kind: PageKind, id: bigint | number): Promise<BuilderDoc | null> {
  return (await getPublishedDoc(`${kind}-${id}`)) ?? (await getPublishedDoc(templateSlug(kind)));
}

/**
 * Ban nhap cho editor; chua co thi dung ban mau: trang chu / header / footer giong giao dien code cung, template
 * dung lai bo cuc trang con hien tai, thiet ke rieng bat dau tu template cua loai do.
 */
export async function getDraft(slug: string) {
  const info = pageInfo(slug);
  const row = await getRow(slug);
  let doc = row ? parseDoc(row.draft) : null;
  // Ban nhap chi gom dung mot "khoi trang" kieu cu (ca trang la 1 khoi, chua sua gi) -> mo bang bo cuc nhieu lop moi
  if (doc && isLegacyOnly(doc)) doc = null;
  if (!doc && info?.kind && info.recordId) {
    const tpl = await getRow(templateSlug(info.kind));
    doc = tpl ? parseDoc(tpl.published ?? tpl.draft) : null;
  }
  // Ten website lay tu Cau hinh he thong (homepage_company) cho noi dung khoi tao cua footer
  doc ??= defaultDoc(info?.kind && info.recordId ? templateSlug(info.kind) : slug, await siteName());
  return {
    doc,
    title: row?.title || info?.title || slug,
    publishedAt: row?.published_at ?? null,
    updatedAt: row?.updated_at ?? null,
    hasDraftChanges: !!row && row.draft !== row.published,
  };
}

const LEGACY_SLOTS = ["catalogueListing", "postBody", "postListing"];
function isLegacyOnly(doc: BuilderDoc) {
  const nodes = Object.values(doc.nodes);
  return nodes.length === 2 && nodes.some((n) => n.type === "slot" && LEGACY_SLOTS.includes(n.props.slot ?? ""));
}

export async function listPages() {
  const rows = await db.$queryRaw<Row[]>`SELECT * FROM builder_pages`;
  const item = (slug: string) => {
    const r = rows.find((x) => x.slug === slug);
    const info = pageInfo(slug);
    return {
      slug,
      title: (info?.landing || (info?.part && slug !== info.part) ? r?.title : null) || info?.title || slug,
      publishedAt: r?.published_at ?? null,
      updatedAt: r?.updated_at ?? null,
      hasDraftChanges: !!r && r.draft !== r.published,
      landing: info?.landing,
    };
  };
  const custom = (re: RegExp) => rows.filter((r) => re.test(r.slug) && pageInfo(r.slug)).map((r) => item(r.slug));
  return {
    pages: Object.keys(BUILDER_PAGES).map(item),
    templates: PAGE_KINDS.map((k) => item(templateSlug(k))),
    overrides: rows.filter((r) => /^(product|catalogue|post|postcat)-\d+$/.test(r.slug)).map((r) => item(r.slug)),
    landings: custom(/^lp-/),
    parts: custom(/^(header|footer)-/),
  };
}

/** Header / footer thiet ke rieng de chon trong "Cài đặt trang" cua editor. */
export async function listCustomParts(): Promise<{ slug: string; title: string; kind: PartKind }[]> {
  const rows = await db.$queryRaw<{ slug: string; title: string }[]>`
    SELECT slug, title FROM builder_pages WHERE slug LIKE 'header-%' OR slug LIKE 'footer-%' ORDER BY title`;
  return rows.flatMap((r) => {
    const kind = partKindOf(r.slug);
    return kind ? [{ slug: r.slug, title: r.title, kind }] : [];
  });
}

/** Tao trang moi (landing / header rieng / footer rieng) voi ban nhap ban dau; slug da co -> loi. */
export async function createPage(slug: string, title: string, doc: BuilderDoc) {
  if (await getRow(slug)) throw new Error("Đường dẫn / tên này đã được dùng.");
  await db.$executeRaw`
    INSERT INTO builder_pages (slug, title, draft, created_at, updated_at) VALUES (${slug}, ${title}, ${JSON.stringify(doc)}, NOW(), NOW())`;
}

/** Landing page da xuat ban theo duong dan (/<path>.html); null = khong co. */
export async function getLanding(path: string): Promise<{ doc: BuilderDoc; title: string } | null> {
  if (!LANDING_PATH.test(path)) return null;
  const row = await getRow(landingSlug(path));
  const doc = row?.published ? parseDoc(row.published) : null;
  return doc ? { doc, title: row!.title } : null;
}

export async function saveDraft(slug: string, doc: BuilderDoc) {
  const json = JSON.stringify(doc);
  const title = pageInfo(slug)?.title ?? slug;
  await db.$executeRaw`
    INSERT INTO builder_pages (slug, title, draft, created_at, updated_at) VALUES (${slug}, ${title}, ${json}, NOW(), NOW())
    ON DUPLICATE KEY UPDATE draft = VALUES(draft), updated_at = NOW()`;
}

export async function publish(slug: string, doc: BuilderDoc) {
  const json = JSON.stringify(doc);
  const title = pageInfo(slug)?.title ?? slug;
  await db.$executeRaw`
    INSERT INTO builder_pages (slug, title, draft, published, published_at, created_at, updated_at)
    VALUES (${slug}, ${title}, ${json}, ${json}, NOW(), NOW(), NOW())
    ON DUPLICATE KEY UPDATE draft = VALUES(draft), published = VALUES(published), published_at = NOW(), updated_at = NOW()`;
}

/** Go xuat ban: storefront quay ve giao dien code cung (hoac template), ban nhap giu nguyen. */
export async function unpublish(slug: string) {
  await db.$executeRaw`UPDATE builder_pages SET published = NULL, published_at = NULL, updated_at = NOW() WHERE slug = ${slug}`;
}

/** Xoa han thiet ke rieng (trang quay ve theo template). */
export async function deletePage(slug: string) {
  await db.$executeRaw`DELETE FROM builder_pages WHERE slug = ${slug}`;
}
