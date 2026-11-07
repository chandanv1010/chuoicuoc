"use server";

import { revalidatePath } from "next/cache";
import { can, getAdmin } from "@/server/auth";
import { firstRecordId, pageRecordSearch, recordOptions, resolveBlockData } from "./data";
import { createPage, deletePage, getDraft, getPublishedDoc, LANDING_PATH, landingSlug, PAGE_KINDS, pageInfo, publish, saveDraft, unpublish } from "./pages";
import { buildDoc } from "./library";
import { findRouter } from "@/modules/frontend/core";
import { renderSlots } from "./slots";
import { siteName } from "@/lib/site";
import { defaultDoc } from "./seed";
import { parseDoc, type BlockData, type PageKind, type RecordKind } from "./schema";

/** Server action cua editor: luu nhap / xuat ban / lay lai du lieu khoi cua hang. Quyen giong "QL Trang chủ". */

const PERMISSION = "home.feature.index";

async function guard(slug: string) {
  const admin = await getAdmin();
  if (!admin || !can(admin, PERMISSION)) throw new Error("Bạn không có quyền sửa giao diện.");
  if (!pageInfo(slug)) throw new Error("Trang không tồn tại.");
}

function validDoc(raw: unknown) {
  const doc = parseDoc(raw);
  if (!doc) throw new Error("Dữ liệu trang không hợp lệ.");
  return doc;
}

export async function saveDraftAction(slug: string, raw: unknown): Promise<{ ok: true }> {
  await guard(slug);
  await saveDraft(slug, validDoc(raw));
  return { ok: true };
}

export async function publishAction(slug: string, raw: unknown): Promise<{ ok: true }> {
  await guard(slug);
  await publish(slug, validDoc(raw));
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function unpublishAction(slug: string): Promise<{ ok: true }> {
  await guard(slug);
  await unpublish(slug);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function blockDataAction(slug: string, raw: unknown): Promise<BlockData> {
  await guard(slug);
  return resolveBlockData(validDoc(raw));
}

/** O tim san pham / bai viet / danh muc trong inspector. */
export async function recordOptionsAction(slug: string, kind: RecordKind, keyword: string, ids?: number[]) {
  await guard(slug);
  if (!["products", "posts", "categories"].includes(kind)) return [];
  return recordOptions(kind, keyword.slice(0, 100), ids?.slice(0, 100).map(Number).filter(Number.isFinite));
}

/** Lay ban dang xuat ban hoac ban mac dinh de editor thay vao (chua luu — nguoi dung bam Lưu / Xuất bản sau). */
export async function resetDocAction(slug: string, mode: "published" | "default") {
  await guard(slug);
  const doc = mode === "published" ? await getPublishedDoc(slug) : defaultDoc(slug, await siteName());
  if (!doc) throw new Error("Trang này chưa từng xuất bản.");
  return { doc, data: await resolveBlockData(doc) };
}

/**
 * Template / thiet ke rieng trang con: du lieu + ban ghi dang xem + cac "khoi trang" da ve san bang giao dien code
 * (React tra ve tu server action). recordId: ban ghi chon de xem truoc (thiet ke rieng thi luon la ban ghi cua no).
 */
export async function previewAction(slug: string, recordId: number | null, raw: unknown) {
  await guard(slug);
  const info = pageInfo(slug)!;
  const doc = validDoc(raw);
  if (!info.kind) return { data: await resolveBlockData(doc), slots: renderSlots(doc, null), recordId: null };
  const id = info.recordId ?? recordId ?? (await firstRecordId(info.kind));
  const ctx = id ? { kind: info.kind, id, page: 1, query: [] as [string, string][], preview: true } : null;
  return { data: await resolveBlockData(doc, ctx), slots: renderSlots(doc, ctx), recordId: id };
}

/** Xoa thiet ke rieng cua mot trang con (trang quay ve theo template), landing page hoac header / footer rieng. */
export async function deleteOverrideAction(slug: string) {
  await guard(slug);
  const info = pageInfo(slug);
  if (!info?.recordId && !info?.landing && !(info?.part && slug !== info.part)) throw new Error("Chỉ xóa được trang tự tạo hoặc thiết kế riêng.");
  await deletePage(slug);
  revalidatePath("/", "layout");
  return { ok: true as const };
}

/** Trang quan ly: tim san pham / danh muc / bai viet de mo thiet ke rieng cho trang do. */
export async function findPageRecordsAction(kind: PageKind, keyword: string) {
  if (!PAGE_KINDS.includes(kind)) return [];
  await guard(`tpl-${kind}`);
  return pageRecordSearch(kind, keyword.slice(0, 100));
}

/** Trang co san cua site dang /<ten>.html — landing page khong duoc trung. */
const RESERVED = ["about", "account", "cart", "checkout", "contact", "login", "products", "quick-checkout", "register", "sitemap", "news"];

const slugify = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

/**
 * Tao landing page (duong dan tu dat, trang trong) hoac header / footer rieng (bat dau tu ban phan chung hien tai).
 * Tra slug de mo trinh dung.
 */
export async function createPageAction(kind: "landing" | "header" | "footer", title: string, path?: string): Promise<{ slug: string }> {
  const name = title.trim().slice(0, 150);
  if (!name) throw new Error("Nhập tên trang.");
  let slug: string;
  let doc;
  if (kind === "landing") {
    const p = slugify(path?.trim() || name);
    if (!LANDING_PATH.test(p)) throw new Error("Đường dẫn chỉ gồm chữ thường không dấu, số và dấu gạch ngang.");
    if (RESERVED.includes(p) || (await findRouter(p))) throw new Error(`Đường dẫn /${p}.html đã có trang khác dùng.`);
    slug = landingSlug(p);
    doc = buildDoc({ type: "page", name, style: { base: { direction: "column", align: "stretch", background: "#ffffff" } } });
  } else {
    const key = slugify(name);
    if (!key) throw new Error("Tên cần có chữ hoặc số.");
    slug = `${kind}-${key}`;
    if (!pageInfo(slug)) throw new Error("Tên không hợp lệ.");
    // Bat dau tu header / footer dang dung (ban xuat ban, chua co thi ban nhap / mac dinh)
    doc = (await getPublishedDoc(kind)) ?? (await getDraft(kind)).doc;
  }
  await guard(slug);
  await createPage(slug, kind === "landing" ? name : `${kind === "header" ? "Header" : "Footer"} · ${name}`, doc);
  return { slug };
}
