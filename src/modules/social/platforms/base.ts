import "server-only";
import type { AccountRow } from "../accounts";
import { invalid } from "../http";
import { localFile, videoInfo, type LocalFile, type VideoInfo } from "../media";
import type { PostMeta, SocialPostRow } from "../posts";
import { FORMAT_SPECS, PLATFORM_LABEL, type Platform } from "../types";

/** Hop dong chung cua adapter tung nen tang. */

export type PublishJob = {
  post: SocialPostRow;
  account: AccountRow;
  /** token hop le (tu refresh); chi goi khi khong phai dry run */
  token: () => Promise<string>;
  meta: PostMeta;
};

export type PublishResult =
  | { done: true; remoteId: string; remoteUrl: string | null; notice?: string }
  /** Da gui, cho nen tang xu ly: worker goi poll() lai sau retryAfterSec giay */
  | { done: false; remoteId?: string | null; state: Record<string, unknown>; retryAfterSec: number; notice?: string };

export interface Adapter {
  platform: Platform;
  /** Kiem tra payload (chay ca o dry run). Loi -> SocialError khong thu lai. */
  validate(job: PublishJob): Promise<void>;
  publish(job: PublishJob): Promise<PublishResult>;
  poll?(job: PublishJob, state: Record<string, unknown>): Promise<PublishResult>;
  /** Ket qua gia cho dry run */
  fakeUrl(job: PublishJob, fakeId: string): string;
}

export const images = (post: SocialPostRow) => post.media.filter((m) => m.type === "image").map((m) => m.url);
export const video = (post: SocialPostRow) => post.media.find((m) => m.type === "video")?.url ?? null;

/** So anh dung theo dinh dang (FORMAT_SPECS). */
export function checkImageCount(post: SocialPostRow) {
  const spec = FORMAT_SPECS[post.format];
  const n = images(post).length;
  if (spec.minImages > 0 && n < spec.minImages) invalid(`${PLATFORM_LABEL[spec.platform]} – ${spec.label}: cần ít nhất ${spec.minImages} ảnh (đang có ${n}).`);
  if (spec.maxImages > 0 && n > spec.maxImages) invalid(`${PLATFORM_LABEL[spec.platform]} – ${spec.label}: tối đa ${spec.maxImages} ảnh (đang có ${n}).`);
}

/** Video bat buoc cho dinh dang video: phai la mp4/mov trong thu vien. */
export async function requireVideo(post: SocialPostRow, opts: { minSec?: number; maxSec?: number; vertical?: boolean } = {}): Promise<LocalFile & { info: VideoInfo }> {
  const spec = FORMAT_SPECS[post.format];
  const url = video(post);
  const label = `${PLATFORM_LABEL[spec.platform]} – ${spec.label}`;
  if (!url) invalid(`${label}: chưa chọn video (mp4).`);
  const file = await localFile(url);
  if (!/^video\/(mp4|quicktime)$/.test(file.mime)) invalid(`${label}: chỉ nhận video MP4/MOV (${file.name}).`);
  const info = await videoInfo(file.abs);
  if (info.duration !== null) {
    if (opts.minSec && info.duration < opts.minSec) invalid(`${label}: video dài ${info.duration.toFixed(1)} giây, tối thiểu ${opts.minSec} giây.`);
    if (opts.maxSec && info.duration > opts.maxSec) invalid(`${label}: video dài ${Math.round(info.duration)} giây, tối đa ${opts.maxSec} giây.`);
  }
  if (opts.vertical && info.width && info.height && info.width >= info.height) {
    invalid(`${label}: cần video dọc (đang là ${info.width}×${info.height}).`);
  }
  return { ...file, info };
}

export function captionOf(post: SocialPostRow) {
  return (post.caption ?? "").trim();
}

/** Chi chu khong dau, an toan cho id gia. */
export function fakeId(platform: Platform, id: bigint) {
  return `dryrun_${platform}_${id}_${Date.now().toString(36)}`;
}
