import "server-only";
import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { invalid, requestJson, SocialError } from "../http";
import { captionOf, requireVideo, type Adapter, type PublishResult } from "./base";

/**
 * YouTube Data API v3 — videos.insert, giao thuc resumable upload.
 *  https://developers.google.com/youtube/v3/docs/videos/insert
 *  https://developers.google.com/youtube/v3/guides/using_resumable_upload_protocol
 *  - B1: POST https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status
 *        (JSON metadata, X-Upload-Content-Length/-Type) -> header Location = session URI
 *  - B2: PUT byte video len session URI -> tai nguyen video {id}
 *  - status.containsSyntheticMedia = true khi noi dung dung AI (bat buoc khai bao noi dung tong hop)
 *  - Han muc: 1 don vi trong bucket "Video Uploads", 100 lan/ngay. Video tu project chua xac minh
 *    KHONG con bi khoa rieng tu (theo tai lieu hien tai).
 *  - App Google o trang thai Testing: refresh token het han sau 7 ngay -> "Can ket noi lai".
 *  - Shorts: video doc (hoac vuong) toi da 3 phut; YouTube tu nhan dien, them #Shorts vao mo ta cho chac.
 * Scope: youtube.upload (+ youtube.readonly de doc ten kenh).
 */

const PRIVACY = ["public", "unlisted", "private"];

function titleOf(title: string | null, fallback: string) {
  // YouTube: toi da 100 ky tu, khong chua < >
  return (title || fallback || "Video").replace(/[<>]/g, "").slice(0, 100);
}

export const youtube: Adapter = {
  platform: "youtube",

  async validate(job) {
    const { post } = job;
    if (post.format !== "yt_video" && post.format !== "yt_short") invalid(`YouTube không hỗ trợ định dạng ${post.format}.`);
    if (!job.account.channel_id) invalid("Tài khoản YouTube chưa có kênh.");
    if (!(post.title ?? "").trim()) invalid("YouTube: chưa nhập tiêu đề video.");
    if ((post.title ?? "").length > 100) invalid(`YouTube: tiêu đề tối đa 100 ký tự (đang ${(post.title ?? "").length}).`);
    if (Buffer.byteLength(captionOf(post), "utf8") > 5000) invalid("YouTube: mô tả tối đa 5000 byte.");
    const tags = job.meta.tags ?? [];
    if (tags.join(",").length > 500) invalid("YouTube: tổng độ dài thẻ (tags) tối đa 500 ký tự.");
    const privacy = String(job.meta.privacy ?? "public");
    if (!PRIVACY.includes(privacy)) invalid("YouTube: chế độ hiển thị không hợp lệ.");
    const f = await requireVideo(post, post.format === "yt_short" ? { maxSec: 180 } : {});
    if (post.format === "yt_short") {
      if (f.info.width && f.info.height && f.info.width > f.info.height) invalid(`YouTube Shorts: cần video dọc hoặc vuông (đang ${f.info.width}×${f.info.height}).`);
    }
  },

  async publish(job): Promise<PublishResult> {
    const { post } = job;
    const token = await job.token();
    const file = await requireVideo(post, post.format === "yt_short" ? { maxSec: 180 } : {});
    let description = captionOf(post);
    if (post.format === "yt_short" && !/#shorts/i.test(description)) description = `${description}\n\n#Shorts`.trim();
    const meta = {
      snippet: { title: titleOf(post.title, ""), description, tags: job.meta.tags ?? [], categoryId: "22" },
      status: {
        privacyStatus: String(job.meta.privacy ?? "public"),
        selfDeclaredMadeForKids: false,
        containsSyntheticMedia: Boolean(post.ai_generated),
      },
    };
    let start: Response;
    try {
      start = await fetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json; charset=UTF-8",
          "X-Upload-Content-Length": String(file.size),
          "X-Upload-Content-Type": file.mime,
        },
        body: JSON.stringify(meta),
        signal: AbortSignal.timeout(60_000),
      });
    } catch (e) {
      throw new SocialError(`Không gọi được YouTube: ${(e as Error).message}`, { retryable: true });
    }
    if (!start.ok) {
      const body = await start.text();
      const quota = /quotaExceeded|uploadLimitExceeded|rateLimitExceeded/.test(body);
      throw new SocialError(`YouTube ${start.status}: ${body.slice(0, 500)}`, { auth: start.status === 401, retryable: quota || start.status >= 500 });
    }
    const session = start.headers.get("location");
    if (!session) throw new SocialError("YouTube không trả về địa chỉ upload (Location).", { retryable: true });
    const video = await requestJson<{ id: string; status?: { uploadStatus?: string; rejectionReason?: string } }>(session, {
      method: "PUT",
      headers: { "Content-Type": file.mime, "Content-Length": String(file.size) },
      body: Readable.toWeb(createReadStream(file.abs)) as unknown as ReadableStream<Uint8Array>,
      duplex: "half",
      timeoutMs: 60 * 60_000,
    } as RequestInit);
    if (video.status?.uploadStatus === "rejected" || video.status?.uploadStatus === "failed") {
      throw new SocialError(`YouTube từ chối video: ${video.status.rejectionReason ?? video.status.uploadStatus}`);
    }
    const url = post.format === "yt_short" ? `https://www.youtube.com/shorts/${video.id}` : `https://www.youtube.com/watch?v=${video.id}`;
    return { done: true, remoteId: video.id, remoteUrl: url };
  },

  fakeUrl(job, id) {
    return job.post.format === "yt_short" ? `https://www.youtube.com/shorts/${id}` : `https://www.youtube.com/watch?v=${id}`;
  },
};
