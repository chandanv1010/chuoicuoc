import "server-only";
import { pinterestApiBase } from "../config";
import { invalid, requestJson, SocialError } from "../http";
import { localFile, readBytes } from "../media";
import { captionOf, checkImageCount, images, requireVideo, type Adapter, type PublishJob, type PublishResult } from "./base";

/**
 * Pinterest API v5 (OpenAPI: https://github.com/pinterest/api-description/blob/main/v5/openapi.yaml).
 *  - Tao ghim: POST /v5/pins {board_id, title<=100, description<=800, link, alt_text, media_source}
 *      https://developers.pinterest.com/docs/api/v5/pins-create/
 *  - Anh: media_source image_base64 (content_type image/jpeg|image/png) -> gui byte, khong can URL cong khai
 *  - Carousel: multiple_image_base64, 2–5 anh
 *  - Video: POST /v5/media {media_type:"video"} -> upload_url + upload_parameters (form S3)
 *      -> GET /v5/media/{media_id} status registered|processing|succeeded|failed
 *      -> POST /v5/pins media_source video_id (+ anh bia base64 hoac cover_image_key_frame_time)
 *      https://developers.pinterest.com/docs/api/v5/media-create/
 *  - Trial access: dung PINTEREST_SANDBOX=1 (api-sandbox.pinterest.com, ca doi token o sandbox; ghim chi chu tai khoan thay).
 * Scope: boards:read, boards:write, pins:read, pins:write, user_accounts:read.
 */

const pinAuthError = (status: number) => status === 401;

/** Anh -> base64 JPEG/PNG (WebP/GIF chuyen sang JPEG bang sharp). */
async function imageBase64(url: string) {
  const f = await readBytes(url);
  if (f.mime === "image/jpeg" || f.mime === "image/png") return { content_type: f.mime, data: f.data.toString("base64") };
  const sharp = (await import("sharp")).default;
  const jpg = await sharp(f.data, { animated: false }).flatten({ background: "#ffffff" }).jpeg({ quality: 90 }).toBuffer();
  return { content_type: "image/jpeg", data: jpg.toString("base64") };
}

function boardOf(job: PublishJob) {
  const board = String(job.meta.board_id || job.account.board_id || "");
  if (!board) invalid("Pinterest: chưa chọn board.");
  return board;
}

function baseFields(job: PublishJob) {
  const { post } = job;
  return {
    board_id: boardOf(job),
    title: (post.title ?? "").slice(0, 100),
    description: captionOf(post).slice(0, 800),
    ...(post.link ? { link: post.link } : {}),
    alt_text: (post.title ?? "").slice(0, 500),
  };
}

async function createPin(job: PublishJob, token: string, media_source: Record<string, unknown>): Promise<PublishResult> {
  const pin = await requestJson<{ id: string }>(
    `${pinterestApiBase()}/pins`,
    { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ ...baseFields(job), media_source }) },
    pinAuthError,
  );
  return { done: true, remoteId: pin.id, remoteUrl: `https://www.pinterest.com/pin/${pin.id}/` };
}

export const pinterest: Adapter = {
  platform: "pinterest",

  async validate(job) {
    const { post } = job;
    boardOf(job);
    if ((post.title ?? "").length > 100) invalid(`Pinterest: tiêu đề tối đa 100 ký tự (đang ${(post.title ?? "").length}).`);
    if (captionOf(post).length > 800) invalid(`Pinterest: mô tả tối đa 800 ký tự (đang ${captionOf(post).length}).`);
    switch (post.format) {
      case "pin_image":
      case "pin_carousel":
        checkImageCount(post);
        for (const u of images(post)) await localFile(u);
        break;
      case "pin_video":
        await requireVideo(post, { minSec: 4, maxSec: 15 * 60 });
        break;
      default:
        invalid(`Pinterest không hỗ trợ định dạng ${post.format}.`);
    }
  },

  async publish(job): Promise<PublishResult> {
    const { post } = job;
    const token = await job.token();
    if (post.format === "pin_image") {
      return createPin(job, token, { source_type: "image_base64", ...(await imageBase64(images(post)[0])) });
    }
    if (post.format === "pin_carousel") {
      const items = [];
      for (const u of images(post)) items.push({ ...(await imageBase64(u)), title: (post.title ?? "").slice(0, 100), ...(post.link ? { link: post.link } : {}) });
      return createPin(job, token, { source_type: "multiple_image_base64", items });
    }
    if (post.format === "pin_video") {
      const file = await requireVideo(post, { minSec: 4, maxSec: 15 * 60 });
      const reg = await requestJson<{ media_id: string; upload_url: string; upload_parameters: Record<string, string> }>(
        `${pinterestApiBase()}/media`,
        { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ media_type: "video" }) },
        pinAuthError,
      );
      const form = new FormData();
      for (const [k, v] of Object.entries(reg.upload_parameters ?? {})) form.set(k, v);
      const bytes = await readBytes(video(post));
      form.set("file", new Blob([new Uint8Array(bytes.data)], { type: file.mime }), file.name);
      const up = await fetch(reg.upload_url, { method: "POST", body: form, signal: AbortSignal.timeout(30 * 60_000) });
      if (!up.ok) throw new SocialError(`Pinterest tải video lỗi ${up.status}: ${(await up.text()).slice(0, 300)}`, { retryable: up.status >= 500 });
      return { done: false, remoteId: reg.media_id, state: { media_id: reg.media_id }, retryAfterSec: 15, notice: "Pinterest đang xử lý video" };
    }
    invalid(`Pinterest không hỗ trợ định dạng ${post.format}.`);
  },

  async poll(job, state): Promise<PublishResult> {
    const token = await job.token();
    const m = await requestJson<{ status?: string }>(`${pinterestApiBase()}/media/${state.media_id}`, { headers: { Authorization: `Bearer ${token}` } }, pinAuthError);
    if (m.status === "failed") throw new SocialError("Pinterest xử lý video thất bại.");
    if (m.status !== "succeeded") return { done: false, remoteId: String(state.media_id), state, retryAfterSec: 20 };
    const cover = images(job.post)[0];
    const coverSource = cover
      ? await imageBase64(cover).then((c) => ({ cover_image_content_type: c.content_type, cover_image_data: c.data }))
      : { cover_image_key_frame_time: 1 };
    return createPin(job, token, { source_type: "video_id", media_id: String(state.media_id), ...coverSource });
  },

  fakeUrl(_job, id) {
    return `https://www.pinterest.com/pin/${id}/`;
  },
};

function video(post: PublishJob["post"]) {
  return post.media.find((m) => m.type === "video")?.url ?? "";
}
