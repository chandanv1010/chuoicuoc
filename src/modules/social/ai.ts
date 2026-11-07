import "server-only";
import type { Platform, SourceType } from "./types";

/**
 * Diem mo rong AI (CHUA cai dat). Giu giao dien on dinh de noi vao sau:
 *
 * 1. Caption AI theo nen tang: LLM viet lai tieu de + mo ta san pham/bai viet thanh caption
 *    phu hop tung nen tang (do dai, giong van, hashtag). Khoi "Dang len mang xa hoi" se goi
 *    endpoint ajax (vd POST /ajax/social/caption) -> generateCaptions() roi dien vao o caption;
 *    nguoi dung van sua truoc khi luu. Khi da dung AI thi bat co "Noi dung co dung AI".
 *
 * 2. Video san pham bang AI: pipeline sau nay tao file mp4 vao thu vien (storage/userfiles/...)
 *    roi goi attachGeneratedVideo() de tao bai dang voi ai_generated = true
 *    (YouTube containsSyntheticMedia, TikTok is_aigc, Facebook reel is_ai_generated).
 *    Luu y TikTok: video khong duoc chen logo/watermark/chu quang cao/link.
 */

export type CaptionRequest = {
  sourceType: SourceType;
  sourceId: bigint;
  title: string;
  /** mo ta / noi dung da bo the HTML */
  description: string;
  link: string | null;
  platforms: Platform[];
  /** ngon ngu dau ra, mac dinh "vi" */
  locale?: string;
};

export type CaptionSuggestion = { platform: Platform; title?: string; caption: string; hashtags?: string[] };

export interface CaptionGenerator {
  generate(req: CaptionRequest): Promise<CaptionSuggestion[]>;
}

export type VideoJob = {
  sourceType: SourceType;
  sourceId: bigint;
  /** anh dau vao (url /userfiles/...) */
  images: string[];
  prompt?: string;
  /** "9:16" cho reel/short/TikTok, "16:9" cho YouTube thuong */
  aspect?: "9:16" | "16:9" | "1:1";
  /** ban sach cho TikTok: khong logo, gia, nut mua */
  clean?: boolean;
};

export type GeneratedVideo = { url: string; durationSec?: number; width?: number; height?: number };

export interface VideoGenerator {
  generate(job: VideoJob): Promise<GeneratedVideo>;
}

let captionGenerator: CaptionGenerator | null = null;
let videoGenerator: VideoGenerator | null = null;

/** Dang ky bo sinh (goi tu noi khoi tao, vd instrumentation). */
export function registerCaptionGenerator(g: CaptionGenerator) {
  captionGenerator = g;
}
export function registerVideoGenerator(g: VideoGenerator) {
  videoGenerator = g;
}

export function aiCaptionAvailable() {
  return captionGenerator !== null;
}

export async function generateCaptions(req: CaptionRequest): Promise<CaptionSuggestion[]> {
  if (!captionGenerator) throw new Error("Chưa cấu hình bộ sinh caption AI");
  return captionGenerator.generate(req);
}

export async function generateVideo(job: VideoJob): Promise<GeneratedVideo> {
  if (!videoGenerator) throw new Error("Chưa cấu hình bộ sinh video AI");
  return videoGenerator.generate(job);
}

/**
 * Gan video AI vao hang doi dang: tao social_posts voi media video + ai_generated = true.
 * Cai dat sau bang insertPosts() (posts.ts) theo cung cach enqueueFromInput() lam.
 */
export type AttachGeneratedVideo = (args: {
  sourceType: SourceType;
  sourceId: bigint;
  video: GeneratedVideo;
  targets: { accountId: bigint; format: string; caption: string; title?: string }[];
  scheduledAt?: Date | null;
}) => Promise<number>;
