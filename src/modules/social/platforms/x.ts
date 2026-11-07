import "server-only";
import { invalid, requestJson, SocialError } from "../http";
import { localFile, readBytes } from "../media";
import { captionLength } from "../types";
import { captionOf, checkImageCount, images, type Adapter, type PublishResult } from "./base";

/**
 * X API v2 (OAuth 2.0 user context).
 *  - Anh: POST https://api.x.com/2/media/upload (multipart: media, media_category=tweet_image) -> data.id
 *      https://docs.x.com/x-api/media/upload-media   (scope media.write)
 *  - Post: POST https://api.x.com/2/tweets {text, media:{media_ids}} -> data.id, toi da 4 anh
 *      https://docs.x.com/x-api/posts/create-post   (scope tweet.write, tweet.read, users.read)
 *  - 280 ky tu cho tai khoan thuong; link tinh 23, emoji 2 (captionLength).
 *  - Gia (pay-per-use, 2026): moi post tru credit; post co link dat hon nhieu post khong link.
 *    Het credit -> 402, khong thu lai.
 */

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const X_IMAGE = /^image\/(jpeg|png|gif|webp)$/;

/** Anh -> byte X nhan (JPEG/PNG/GIF/WEBP, <= 5MB); qua lon hoac dinh dang khac thi chuyen JPEG bang sharp. */
async function imageFile(url: string) {
  const f = await readBytes(url);
  if (X_IMAGE.test(f.mime) && f.data.length <= MAX_IMAGE_BYTES) return { data: f.data, mime: f.mime, name: f.name };
  const sharp = (await import("sharp")).default;
  let quality = 90;
  let out = await sharp(f.data, { animated: false }).flatten({ background: "#ffffff" }).resize({ width: 4096, height: 4096, fit: "inside", withoutEnlargement: true }).jpeg({ quality }).toBuffer();
  while (out.length > MAX_IMAGE_BYTES && quality > 50) {
    quality -= 10;
    out = await sharp(f.data, { animated: false }).flatten({ background: "#ffffff" }).resize({ width: 2048, height: 2048, fit: "inside", withoutEnlargement: true }).jpeg({ quality }).toBuffer();
  }
  return { data: out, mime: "image/jpeg", name: f.name.replace(/\.\w+$/, ".jpg") };
}

/** 402 = het credit X API; 403 = app/tai khoan khong co quyen ghi -> khong thu lai. */
const xAuthError = (status: number) => status === 401;

function xError(e: unknown): never {
  if (e instanceof SocialError && / 402: /.test(e.message)) throw new SocialError(`${e.message} (tài khoản X API hết credit — nạp thêm trong Developer Console)`);
  throw e;
}

export const x: Adapter = {
  platform: "x",

  async validate(job) {
    const { post } = job;
    if (post.format !== "x_post") invalid(`X không hỗ trợ định dạng ${post.format}.`);
    const text = captionOf(post);
    const list = images(post);
    if (!text && !list.length) invalid("X: cần nội dung hoặc ít nhất 1 ảnh.");
    const n = captionLength("x", text);
    if (n > 280) invalid(`X: nội dung tối đa 280 ký tự (đang ${n}; link tính 23, emoji tính 2).`);
    checkImageCount(post);
    for (const u of list) await localFile(u);
  },

  async publish(job): Promise<PublishResult> {
    const { post } = job;
    const token = await job.token();
    const auth = { Authorization: `Bearer ${token}` };
    try {
      const mediaIds: string[] = [];
      for (const u of images(post)) {
        const img = await imageFile(u);
        const form = new FormData();
        form.set("media", new Blob([new Uint8Array(img.data)], { type: img.mime }), img.name);
        form.set("media_category", "tweet_image");
        const up = await requestJson<{ data?: { id?: string } }>("https://api.x.com/2/media/upload", { method: "POST", headers: auth, body: form, timeoutMs: 5 * 60_000 }, xAuthError);
        if (!up.data?.id) throw new SocialError("X không trả về media id sau khi tải ảnh.", { retryable: true });
        mediaIds.push(up.data.id);
      }
      const text = captionOf(post);
      const body = { ...(text ? { text } : {}), ...(mediaIds.length ? { media: { media_ids: mediaIds } } : {}) };
      const r = await requestJson<{ data?: { id: string } }>(
        "https://api.x.com/2/tweets",
        { method: "POST", headers: { ...auth, "Content-Type": "application/json" }, body: JSON.stringify(body) },
        xAuthError,
      );
      if (!r.data?.id) throw new SocialError("X không trả về id bài đăng.", { retryable: true });
      const user = job.account.username;
      return { done: true, remoteId: r.data.id, remoteUrl: user ? `https://x.com/${user}/status/${r.data.id}` : `https://x.com/i/web/status/${r.data.id}` };
    } catch (e) {
      xError(e);
    }
  },

  fakeUrl(job, id) {
    return `https://x.com/${job.account.username ?? "i/web"}/status/${id}`;
  },
};
