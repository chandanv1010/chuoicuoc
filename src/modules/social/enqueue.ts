import "server-only";
import { flash } from "@/lib/flash";
import { db } from "@/lib/db";
import { now } from "@/lib/helpers";
import type { Input } from "@/lib/http";
import { can, getAdmin } from "@/server/auth";
import { listAccounts } from "./accounts";
import { isDryRun, siteUrl } from "./config";
import { insertPosts, type NewSocialPost, type PostMeta } from "./posts";
import { FORMAT_SPECS, FORMATS, PLATFORM_LABEL, withHashtags, type MediaItem, type SocialPublishInput, type SourceType } from "./types";
import { startSocialWorker, tick } from "./worker";

/**
 * Tao cac dong social_posts tu khoi "Dang len mang xa hoi" (o an social_publish, JSON)
 * trong form san pham / bai viet. Goi SAU khi luu san pham/bai viet thanh cong;
 * khong bao gio nem loi ra ngoai de khong anh huong hanh vi luu cu.
 */

export const SOCIAL_FIELD = "social_publish";

export function parseSocialInput(input: Input): SocialPublishInput | null {
  const raw = input[SOCIAL_FIELD];
  if (typeof raw !== "string" || !raw.trim()) return null;
  try {
    const v = JSON.parse(raw) as SocialPublishInput;
    if (!v || typeof v !== "object" || !Array.isArray(v.targets)) return null;
    return v;
  } catch {
    return null;
  }
}

/** "2026-10-25T14:30" (gio VN) -> Date luu kieu Laravel (gio dia phuong ghi nhu UTC). */
export function parseSchedule(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(s ?? "");
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]));
  return Number.isNaN(d.getTime()) || d.getTime() <= now().getTime() ? null : d;
}

/** Link chinh tac (canonical) cua san pham / bai viet tren website cong khai (SOCIAL_SITE_URL). */
export async function canonicalUrl(sourceType: SourceType, id: bigint) {
  const rows =
    sourceType === "Product"
      ? await db.$queryRaw<{ canonical: string | null }[]>`SELECT canonical FROM product_language WHERE product_id = ${id} ORDER BY language_id LIMIT 1`
      : await db.$queryRaw<{ canonical: string | null }[]>`SELECT canonical FROM post_language WHERE post_id = ${id} ORDER BY language_id LIMIT 1`;
  return siteUrl(rows[0]?.canonical ?? null);
}

const isMediaUrl = (u: unknown): u is string => typeof u === "string" && u.trim() !== "" && !/^\s*</.test(u);

/**
 * Tao hang doi tu form. Tra ve so bai tao + loi (muc bi bo qua).
 * `userId`: admin dang luu.
 */
export async function enqueueFromInput(input: Input, sourceType: SourceType, sourceId: bigint, userId: bigint | null) {
  const data = parseSocialInput(input);
  if (!data || !data.enabled || !data.targets.length) return { created: 0, errors: [] as string[] };
  const errors: string[] = [];
  const admin = await getAdmin();
  if (!admin || !can(admin, "social.post.create")) return { created: 0, errors: ["Bạn không có quyền đăng lên mạng xã hội (social.post.create)."] };

  const accounts = new Map((await listAccounts()).map((a) => [a.id.toString(), a]));
  const imagesAll = (data.images ?? []).filter(isMediaUrl).map((u) => u.trim());
  const video = isMediaUrl(data.video) ? data.video.trim() : "";
  const link = await canonicalUrl(sourceType, sourceId);
  const scheduledAt = parseSchedule(data.schedule);
  const rows: NewSocialPost[] = [];

  for (const t of data.targets) {
    const account = accounts.get(String(t.account_id));
    if (!account) {
      errors.push(`Tài khoản #${t.account_id} không còn tồn tại.`);
      continue;
    }
    const label = `${PLATFORM_LABEL[account.platform]} (${account.name})`;
    if (account.status !== "active") {
      errors.push(`${label}: tài khoản cần kết nối lại, bỏ qua.`);
      continue;
    }
    if (!(FORMATS as readonly string[]).includes(t.format) || FORMAT_SPECS[t.format].platform !== account.platform) {
      errors.push(`${label}: định dạng ${t.format} không hợp lệ.`);
      continue;
    }
    const spec = FORMAT_SPECS[t.format];
    // Kiem tra nhanh (kiem tra day du chay trong worker/adapter)
    if (spec.video && !video) {
      errors.push(`${label} – ${spec.label}: chưa chọn video, bỏ qua.`);
      continue;
    }
    const imgs = spec.maxImages ? imagesAll.slice(0, spec.maxImages) : [];
    if (spec.minImages && imgs.length < spec.minImages) {
      errors.push(`${label} – ${spec.label}: cần ít nhất ${spec.minImages} ảnh, bỏ qua.`);
      continue;
    }
    const media: MediaItem[] = [...imgs.map((url) => ({ type: "image" as const, url }))];
    if (spec.video) {
      media.push({ type: "video", url: video });
      // anh bia cho ghim video
      if (t.format === "pin_video" && imagesAll[0]) media.unshift({ type: "image", url: imagesAll[0] });
    }
    if (account.platform === "tiktok" && !t.tiktok?.consent) {
      errors.push(`${label}: chưa xác nhận đồng ý gửi nội dung lên TikTok, bỏ qua.`);
      continue;
    }
    if (account.platform === "tiktok" && !t.tiktok?.privacy_level) {
      errors.push(`${label}: chưa chọn quyền riêng tư TikTok, bỏ qua.`);
      continue;
    }
    // TikTok: khong chen link vao noi dung; hashtag van them duoc
    const caption = withHashtags(String(t.caption ?? ""), String(data.hashtags ?? ""));
    const meta: PostMeta = { hashtags: data.hashtags ?? "" };
    if (t.board_id) meta.board_id = String(t.board_id);
    if (t.privacy) meta.privacy = String(t.privacy);
    if (t.tags) meta.tags = String(t.tags).split(",").map((s) => s.trim()).filter(Boolean);
    if (t.tiktok) meta.tiktok = { ...t.tiktok };
    rows.push({
      source_type: sourceType,
      source_id: sourceId,
      account_id: account.id,
      platform: account.platform,
      format: t.format,
      title: t.title ? String(t.title).slice(0, 255) : null,
      caption,
      description: null,
      link: account.platform === "tiktok" ? null : link,
      media,
      ai_generated: Boolean(data.ai_generated),
      meta,
      scheduled_at: scheduledAt,
      dry_run: isDryRun(account.platform) || Boolean(account.meta?.dry_run),
      user_id: userId,
    });
  }
  if (rows.length) await insertPosts(rows);
  return { created: rows.length, errors };
}

/**
 * Goi tu handler store/update cua product/post sau khi luu thanh cong.
 * Khong nem loi; thong bao bang flash (them vao flash success san co).
 */
export async function enqueueSocialAfterSave(input: Input, sourceType: SourceType, sourceId: bigint | number | string, userId: bigint | null) {
  try {
    const { created, errors } = await enqueueFromInput(input, sourceType, BigInt(sourceId), userId);
    if (!created && !errors.length) return;
    if (errors.length) await flash({ error: `Mạng xã hội: ${errors.join(" ")}` });
    if (created) {
      // Ket qua hien o khoi "Lich su dang" cua trang sua + trang Lich su dang
      startSocialWorker();
      // dang ngay: chay mot luot nen, khong cho
      void tick();
    }
  } catch (e) {
    console.error("[social] enqueue", e);
    await flash({ error: "Lưu thành công nhưng không tạo được lịch đăng mạng xã hội. Hãy thử lại ở trang sửa." });
  }
}
