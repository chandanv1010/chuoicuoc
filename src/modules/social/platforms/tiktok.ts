import "server-only";
import { tiktokAudited } from "../config";
import { invalid, requestJson, SocialError } from "../http";
import { publicJpegUrl, readChunk } from "../media";
import type { TikTokOptions } from "../types";
import { captionOf, checkImageCount, images, requireVideo, type Adapter, type PublishJob, type PublishResult } from "./base";

/**
 * TikTok Content Posting API — Direct Post.
 *  - Creator info (bat buoc goi truoc, lay privacy_level_options, max_video_post_duration_sec):
 *      POST https://open.tiktokapis.com/v2/post/publish/creator_info/query/
 *      https://developers.tiktok.com/doc/content-posting-api-reference-query-creator-info
 *  - Video: POST /v2/post/publish/video/init/ (source FILE_UPLOAD) roi PUT tung chunk len upload_url
 *      https://developers.tiktok.com/doc/content-posting-api-reference-direct-post
 *      Chunk 5–64 MB (chunk cuoi toi 128 MB), file < 5 MB gui 1 chunk, toi da 1000 chunk:
 *      https://developers.tiktok.com/doc/content-posting-api-media-transfer-guide
 *  - Anh: POST /v2/post/publish/content/init/ (media_type PHOTO, chi PULL_FROM_URL, URL phai thuoc
 *    ten mien/URL prefix da xac minh; toi da 35 anh; title 90, description 4000)
 *      https://developers.tiktok.com/doc/content-posting-api-reference-photo-post
 *  - Trang thai: POST /v2/post/publish/status/fetch/ (PROCESSING_UPLOAD/DOWNLOAD, PUBLISH_COMPLETE, FAILED)
 *      https://developers.tiktok.com/doc/content-posting-api-reference-get-video-status
 *  - App chua qua audit: moi bai o che do rieng tu (SELF_ONLY), toi da 5 nguoi dung / 24h.
 *  - UI theo https://developers.tiktok.com/doc/content-sharing-guidelines (xem social-block-client.tsx)
 * Scope: video.publish. Gioi han: 6 request init / phut / token.
 */

const API = "https://open.tiktokapis.com/v2";
/**
 * Anh photo mode toi da 1080p; album tron nhieu kho (ngang/vuong/doc) bi picture_size_check_failed
 * -> moi anh dat vao cung khung 9:16 1080x1920 nen trang.
 */
const PHOTO_FIT = { w: 1080, h: 1920, pad: true };

export type CreatorInfo = {
  creator_avatar_url?: string;
  creator_username?: string;
  creator_nickname?: string;
  privacy_level_options?: string[];
  comment_disabled?: boolean;
  duet_disabled?: boolean;
  stitch_disabled?: boolean;
  max_video_post_duration_sec?: number;
};

const authHeaders = (token: string) => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=UTF-8" });

const tiktokAuthError = (_s: number, body: unknown) => {
  const code = (body as { error?: { code?: string } })?.error?.code;
  return code === "access_token_invalid" || code === "scope_not_authorized" || code === "token_not_authorized_for_specified_scope";
};

export async function queryCreatorInfo(token: string): Promise<CreatorInfo> {
  const r = await requestJson<{ data?: CreatorInfo }>(`${API}/post/publish/creator_info/query/`, { method: "POST", headers: authHeaders(token), body: "{}" }, tiktokAuthError);
  return r.data ?? {};
}

/** Creator info gia cho dry run (app chua audit -> chi SELF_ONLY). */
export function fakeCreatorInfo(name: string): CreatorInfo {
  return {
    creator_nickname: name,
    creator_username: "dry_run",
    privacy_level_options: tiktokAudited() ? ["PUBLIC_TO_EVERYONE", "MUTUAL_FOLLOW_FRIENDS", "SELF_ONLY"] : ["SELF_ONLY"],
    comment_disabled: false,
    duet_disabled: false,
    stitch_disabled: true,
    max_video_post_duration_sec: 600,
  };
}

function options(job: PublishJob): TikTokOptions {
  const o = (job.meta.tiktok ?? {}) as Partial<TikTokOptions>;
  return {
    privacy_level: String(o.privacy_level ?? ""),
    disable_comment: Boolean(o.disable_comment),
    disable_duet: Boolean(o.disable_duet),
    disable_stitch: Boolean(o.disable_stitch),
    commercial: Boolean(o.commercial),
    brand_organic: Boolean(o.brand_organic),
    brand_content: Boolean(o.brand_content),
    consent: Boolean(o.consent),
  };
}

export const SELF_ONLY_NOTICE = "App TikTok chưa qua audit Direct Post: bài chỉ hiển thị riêng tư (SELF_ONLY), tối đa 5 người dùng đăng/24 giờ.";

function checkOptions(job: PublishJob, o: TikTokOptions) {
  if (!o.consent) invalid("TikTok: chưa xác nhận đồng ý gửi nội dung lên TikTok.");
  if (!o.privacy_level) invalid("TikTok: chưa chọn quyền riêng tư (bắt buộc, không có giá trị mặc định).");
  if (o.commercial && !o.brand_organic && !o.brand_content) invalid("TikTok: đã bật nội dung thương mại thì phải chọn \"Thương hiệu của bạn\" hoặc \"Nội dung có tài trợ\".");
  if (o.brand_content && o.privacy_level === "SELF_ONLY") invalid("TikTok: nội dung có tài trợ (branded content) không thể để chế độ riêng tư.");
  if (!tiktokAudited() && o.privacy_level !== "SELF_ONLY") invalid(`TikTok: ${SELF_ONLY_NOTICE} Hãy chọn "Chỉ mình tôi".`);
  if (/https?:\/\/|www\./i.test(captionOf(job.post))) invalid("TikTok: không được chèn link vào nội dung đăng TikTok (theo hướng dẫn của TikTok).");
}

/** Chia chunk theo media transfer guide. */
export function chunkPlan(size: number) {
  const MB = 1024 * 1024;
  if (size < 5 * MB) return { chunkSize: size, count: 1 };
  const chunkSize = 10 * MB;
  return { chunkSize, count: Math.max(1, Math.floor(size / chunkSize)) };
}

export const tiktok: Adapter = {
  platform: "tiktok",

  async validate(job) {
    const { post } = job;
    const o = options(job);
    checkOptions(job, o);
    if (post.format === "tiktok_video") {
      const caption = captionOf(post);
      if (caption.length > 2200) invalid(`TikTok: tiêu đề video tối đa 2200 ký tự (đang ${caption.length}).`);
      await requireVideo(post, { minSec: 1 });
    } else if (post.format === "tiktok_photo") {
      checkImageCount(post);
      if ((post.title ?? "").length > 90) invalid("TikTok – Ảnh: tiêu đề tối đa 90 ký tự.");
      if (captionOf(post).length > 4000) invalid("TikTok – Ảnh: mô tả tối đa 4000 ký tự.");
      // bai anh chi co tuy chon Comment (duet/stitch khong gui)
      for (const u of images(post)) publicJpegUrl(u, "TikTok (đăng ảnh)");
    } else {
      invalid(`TikTok không hỗ trợ định dạng ${post.format}.`);
    }
  },

  async publish(job): Promise<PublishResult> {
    const { post } = job;
    const token = await job.token();
    const o = options(job);
    checkOptions(job, o);
    const info = await queryCreatorInfo(token);
    const allowed = info.privacy_level_options ?? [];
    if (!allowed.includes(o.privacy_level)) {
      throw new SocialError(`TikTok: quyền riêng tư "${o.privacy_level}" không còn hợp lệ cho tài khoản này (cho phép: ${allowed.join(", ") || "không có"}). Có thể tài khoản chưa đăng được lúc này.`);
    }
    const notice = o.privacy_level === "SELF_ONLY" && !tiktokAudited() ? SELF_ONLY_NOTICE : undefined;
    const brand = { brand_content_toggle: o.commercial && o.brand_content, brand_organic_toggle: o.commercial && o.brand_organic };

    if (post.format === "tiktok_video") {
      const file = await requireVideo(post, { minSec: 1 });
      if (info.max_video_post_duration_sec && file.info.duration && file.info.duration > info.max_video_post_duration_sec) {
        throw new SocialError(`TikTok: video dài ${Math.round(file.info.duration)} giây, tài khoản này chỉ cho tối đa ${info.max_video_post_duration_sec} giây.`);
      }
      const { chunkSize, count } = chunkPlan(file.size);
      const init = await requestJson<{ data: { publish_id: string; upload_url: string } }>(
        `${API}/post/publish/video/init/`,
        {
          method: "POST",
          headers: authHeaders(token),
          body: JSON.stringify({
            post_info: {
              title: captionOf(post),
              privacy_level: o.privacy_level,
              disable_comment: o.disable_comment || Boolean(info.comment_disabled),
              disable_duet: o.disable_duet || Boolean(info.duet_disabled),
              disable_stitch: o.disable_stitch || Boolean(info.stitch_disabled),
              ...brand,
              is_aigc: Boolean(post.ai_generated),
            },
            source_info: { source: "FILE_UPLOAD", video_size: file.size, chunk_size: chunkSize, total_chunk_count: count },
          }),
        },
        tiktokAuthError,
      );
      for (let i = 0; i < count; i++) {
        const start = i * chunkSize;
        const end = i === count - 1 ? file.size : start + chunkSize; // chunk cuoi gom phan du
        const data = await readChunk(file.abs, start, end - start);
        const res = await fetch(init.data.upload_url, {
          method: "PUT",
          headers: { "Content-Type": file.mime, "Content-Length": String(data.length), "Content-Range": `bytes ${start}-${end - 1}/${file.size}` },
          body: new Uint8Array(data),
          signal: AbortSignal.timeout(10 * 60_000),
        });
        if (!res.ok && res.status !== 206) throw new SocialError(`TikTok upload chunk ${i + 1}/${count} lỗi ${res.status}: ${(await res.text()).slice(0, 300)}`, { retryable: res.status >= 500 });
      }
      return { done: false, remoteId: init.data.publish_id, state: { publish_id: init.data.publish_id, username: info.creator_username ?? null }, retryAfterSec: 30, notice };
    }

    if (post.format === "tiktok_photo") {
      const urls = images(post).map((u) => publicJpegUrl(u, "TikTok (đăng ảnh)", PHOTO_FIT));
      const init = await requestJson<{ data: { publish_id: string } }>(
        `${API}/post/publish/content/init/`,
        {
          method: "POST",
          headers: authHeaders(token),
          body: JSON.stringify({
            media_type: "PHOTO",
            post_mode: "DIRECT_POST",
            post_info: {
              title: (post.title ?? "").slice(0, 90),
              description: captionOf(post),
              privacy_level: o.privacy_level,
              disable_comment: o.disable_comment || Boolean(info.comment_disabled),
              auto_add_music: true,
              ...brand,
            },
            source_info: { source: "PULL_FROM_URL", photo_cover_index: 0, photo_images: urls },
            is_aigc: Boolean(post.ai_generated),
          }),
        },
        tiktokAuthError,
      );
      return { done: false, remoteId: init.data.publish_id, state: { publish_id: init.data.publish_id, username: info.creator_username ?? null }, retryAfterSec: 30, notice };
    }

    invalid(`TikTok không hỗ trợ định dạng ${post.format}.`);
  },

  async poll(job, state): Promise<PublishResult> {
    const token = await job.token();
    const r = await requestJson<{ data?: { status?: string; fail_reason?: string; publicaly_available_post_id?: (string | number)[] } }>(
      `${API}/post/publish/status/fetch/`,
      { method: "POST", headers: authHeaders(token), body: JSON.stringify({ publish_id: state.publish_id }) },
      tiktokAuthError,
    );
    const d = r.data ?? {};
    if (d.status === "FAILED") {
      throw new SocialError(`TikTok báo lỗi: ${d.fail_reason ?? "không rõ"}`, { retryable: d.fail_reason === "internal" });
    }
    if (d.status === "PUBLISH_COMPLETE") {
      const postId = d.publicaly_available_post_id?.[0];
      // Bai rieng tu / chua kiem duyet xong thi khong co post id cong khai
      const url = postId && state.username ? `https://www.tiktok.com/@${state.username}/${job.post.format === "tiktok_photo" ? "photo" : "video"}/${postId}` : null;
      return { done: true, remoteId: String(postId ?? state.publish_id), remoteUrl: url };
    }
    return { done: false, remoteId: String(state.publish_id), state, retryAfterSec: 30 };
  },

  fakeUrl(job, id) {
    return `https://www.tiktok.com/@dry_run/${job.post.format === "tiktok_photo" ? "photo" : "video"}/${id}`;
  },
};
