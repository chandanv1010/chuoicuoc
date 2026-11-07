/**
 * Kieu va hang so dung chung (ca server lan client) cua module mang xa hoi.
 * Khong import gi phia server o day.
 */

export const PLATFORMS = ["facebook", "instagram", "tiktok", "youtube", "pinterest", "x"] as const;
export type Platform = (typeof PLATFORMS)[number];

/** Key OAuth: Facebook + Instagram dung chung mot app Meta (/social/connect/facebook). */
export const OAUTH_KEYS = ["facebook", "tiktok", "youtube", "pinterest", "x"] as const;
export type OAuthKey = (typeof OAUTH_KEYS)[number];

export const PLATFORM_LABEL: Record<Platform, string> = {
  facebook: "Facebook Page",
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  pinterest: "Pinterest",
  x: "X (Twitter)",
};

export const FORMATS = [
  "fb_feed",
  "fb_photos",
  "fb_video",
  "fb_reel",
  "ig_image",
  "ig_carousel",
  "ig_reel",
  "tiktok_photo",
  "tiktok_video",
  "yt_video",
  "yt_short",
  "pin_image",
  "pin_video",
  "pin_carousel",
  "x_post",
] as const;
export type Format = (typeof FORMATS)[number];

export type FormatSpec = {
  platform: Platform;
  label: string;
  /** can video (mp4) */
  video?: boolean;
  /** so anh toi thieu / toi da (0 = khong dung anh) */
  minImages: number;
  maxImages: number;
  hint?: string;
};

/** Gioi han lay tu tai lieu chinh thuc (link trong platforms/*.ts). */
export const FORMAT_SPECS: Record<Format, FormatSpec> = {
  fb_feed: { platform: "facebook", label: "Bài viết + link", minImages: 0, maxImages: 0 },
  fb_photos: { platform: "facebook", label: "Ảnh / album ảnh", minImages: 1, maxImages: 30 },
  fb_video: { platform: "facebook", label: "Video", video: true, minImages: 0, maxImages: 0 },
  fb_reel: { platform: "facebook", label: "Reel", video: true, minImages: 0, maxImages: 0, hint: "3–90 giây, dọc 9:16" },
  ig_image: { platform: "instagram", label: "Ảnh", minImages: 1, maxImages: 1, hint: "Chỉ JPEG (tự chuyển)" },
  ig_carousel: { platform: "instagram", label: "Carousel", minImages: 2, maxImages: 20, hint: "2–20 ảnh" },
  ig_reel: { platform: "instagram", label: "Reel", video: true, minImages: 0, maxImages: 0 },
  tiktok_video: { platform: "tiktok", label: "Video", video: true, minImages: 0, maxImages: 0 },
  tiktok_photo: { platform: "tiktok", label: "Ảnh (photo mode)", minImages: 1, maxImages: 35, hint: "Cần URL công khai đã xác minh" },
  yt_video: { platform: "youtube", label: "Video", video: true, minImages: 0, maxImages: 0 },
  yt_short: { platform: "youtube", label: "Shorts", video: true, minImages: 0, maxImages: 0, hint: "Video dọc, tối đa 3 phút" },
  pin_image: { platform: "pinterest", label: "Ghim ảnh", minImages: 1, maxImages: 1 },
  pin_video: { platform: "pinterest", label: "Ghim video", video: true, minImages: 0, maxImages: 0 },
  pin_carousel: { platform: "pinterest", label: "Ghim carousel", minImages: 2, maxImages: 5, hint: "2–5 ảnh" },
  x_post: { platform: "x", label: "Post (kèm ảnh)", minImages: 0, maxImages: 4, hint: "Tối đa 4 ảnh" },
};

export function formatsOf(platform: Platform): Format[] {
  return FORMATS.filter((f) => FORMAT_SPECS[f].platform === platform);
}

/** Gioi han ky tu cua noi dung chinh (caption) va tieu de theo nen tang. */
export const TEXT_LIMITS: Record<Platform, { caption: number; title?: number; captionLabel: string }> = {
  facebook: { caption: 63206, captionLabel: "Nội dung bài" },
  instagram: { caption: 2200, captionLabel: "Caption" },
  // video: title 2200; photo: title 90 + description 4000
  tiktok: { caption: 2200, title: 90, captionLabel: "Tiêu đề / mô tả" },
  youtube: { caption: 5000, title: 100, captionLabel: "Mô tả" },
  pinterest: { caption: 800, title: 100, captionLabel: "Mô tả ghim" },
  // tai khoan thuong (khong Premium); dem theo captionLength("x", ...)
  x: { caption: 280, captionLabel: "Nội dung post" },
};

export const POST_STATUS_LABEL: Record<string, string> = {
  queued: "Chờ đăng",
  processing: "Đang xử lý",
  published: "Đã đăng",
  failed: "Lỗi",
  cancelled: "Đã hủy",
};

export const ACCOUNT_STATUS_LABEL: Record<string, string> = {
  active: "Đang kết nối",
  needs_reconnect: "Cần kết nối lại",
  disabled: "Đã tắt",
};

export type SourceType = "Product" | "Post";

/** TikTok Direct Post: lua chon bat buoc theo content-sharing-guidelines. */
export type TikTokOptions = {
  privacy_level: string;
  disable_comment: boolean;
  disable_duet: boolean;
  disable_stitch: boolean;
  commercial: boolean;
  brand_organic: boolean;
  brand_content: boolean;
  consent: boolean;
};

/** Mot muc dich dang trong form (JSON trong o an social_publish). */
export type SocialTargetInput = {
  account_id: string;
  format: Format;
  title?: string;
  caption: string;
  board_id?: string;
  privacy?: string;
  tags?: string;
  tiktok?: TikTokOptions;
};

export type SocialPublishInput = {
  enabled: boolean;
  targets: SocialTargetInput[];
  images: string[];
  video: string;
  hashtags: string;
  ai_generated: boolean;
  /** "" = dang ngay; "YYYY-MM-DDTHH:mm" gio Viet Nam */
  schedule: string;
};

export type MediaItem = { type: "image" | "video"; url: string };

/** Them hashtag vao cuoi caption (khong trung cai da co). */
export function withHashtags(caption: string, hashtags: string) {
  const tags = hashtags
    .split(/[\s,]+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => (t.startsWith("#") ? t : `#${t}`))
    .filter((t) => !caption.includes(t));
  return tags.length ? `${caption.trimEnd()}\n\n${tags.join(" ")}` : caption;
}

/** Do dai kieu UTF-16 (TikTok/IG dem theo don vi nay). */
export function textLength(s: string) {
  return s.length;
}

/**
 * Do dai caption theo cach dem cua nen tang. X: moi link tinh 23 ky tu (t.co), emoji va chu CJK
 * tinh 2 (https://docs.x.com/fundamentals/counting-characters); cac nen tang khac: UTF-16.
 */
export function captionLength(platform: Platform, s: string) {
  if (platform !== "x") return s.length;
  let n = 0;
  for (const part of s.split(/(https?:\/\/\S+)/)) {
    if (/^https?:\/\//.test(part)) {
      n += 23;
      continue;
    }
    for (const ch of part) n += /\p{Extended_Pictographic}|[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]/u.test(ch) ? 2 : 1;
  }
  return n;
}
