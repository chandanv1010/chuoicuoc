import "server-only";
import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { refreshToken } from "../accounts";
import { credentials, META_GRAPH_VERSION } from "../config";
import { invalid, requestJson, SocialError } from "../http";
import { localFile, readBytes } from "../media";
import { metaAuthError } from "../oauth";
import { captionOf, checkImageCount, images, requireVideo, type Adapter, type PublishJob, type PublishResult } from "./base";

/**
 * Facebook Page (Graph API, Page access token).
 *  - Bai viet + link: POST /{page-id}/feed (message, link)
 *      https://developers.facebook.com/docs/pages-api/posts
 *  - Anh: POST /{page-id}/photos (multipart source); nhieu anh: tai tung anh published=false
 *    roi POST /{page-id}/feed voi attached_media[i]={"media_fbid":...}
 *      https://developers.facebook.com/docs/graph-api/reference/page/photos/
 *  - Video: Resumable Upload API (POST /{app-id}/uploads -> POST /upload:<session> -> file handle)
 *    roi POST graph-video.facebook.com/{page-id}/videos (fbuploader_video_file_chunk)
 *      https://developers.facebook.com/docs/video-api/guides/publishing
 *  - Reel: POST /{page-id}/video_reels upload_phase=start -> rupload.facebook.com/video-upload/{video-id}
 *    -> upload_phase=finish video_state=PUBLISHED; poll GET /{video-id}?fields=status
 *    (3–90 giay, 9:16, toi da 30 reel API / 24h / Page)
 *      https://developers.facebook.com/docs/video-api/guides/reels-publishing
 * Quyen: pages_show_list, pages_read_engagement, pages_manage_posts (du cho ca /videos; publish_video da bi Meta bo).
 */

const graph = (path: string, host = "graph.facebook.com") => `https://${host}/${META_GRAPH_VERSION()}${path}`;

async function graphPost<T = Record<string, unknown>>(url: string, token: string, fields: Record<string, string>, host?: string) {
  return requestJson<T>(graph(url, host), { method: "POST", body: new URLSearchParams({ ...fields, access_token: token }) }, metaAuthError);
}

/** Tai mot anh len Page (multipart source = byte tu o dia). */
async function uploadPhoto(pageId: string, token: string, url: string, fields: Record<string, string>) {
  const f = await readBytes(url);
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.set(k, v);
  form.set("access_token", token);
  form.set("source", new Blob([new Uint8Array(f.data)], { type: f.mime }), f.name);
  return requestJson<{ id: string; post_id?: string }>(graph(`/${pageId}/photos`), { method: "POST", body: form }, metaAuthError);
}

/** Body stream tu file (khong nap ca video vao RAM). */
function fileStream(abs: string) {
  return Readable.toWeb(createReadStream(abs)) as unknown as ReadableStream<Uint8Array>;
}

function pageIdOf(job: PublishJob) {
  const id = job.account.page_id;
  if (!id) invalid("Tài khoản Facebook chưa chọn Page.");
  return id;
}

export const facebook: Adapter = {
  platform: "facebook",

  async validate(job) {
    const { post } = job;
    pageIdOf(job);
    switch (post.format) {
      case "fb_feed":
        if (!captionOf(post) && !post.link) invalid("Facebook – Bài viết: cần nội dung hoặc link.");
        break;
      case "fb_photos":
        checkImageCount(post);
        for (const u of images(post)) await localFile(u);
        break;
      case "fb_video":
        await requireVideo(post);
        break;
      case "fb_reel":
        await requireVideo(post, { minSec: 3, maxSec: 90 });
        break;
      default:
        invalid(`Facebook không hỗ trợ định dạng ${post.format}.`);
    }
  },

  async publish(job): Promise<PublishResult> {
    const { post } = job;
    const pageId = pageIdOf(job);
    const token = await job.token();
    const message = captionOf(post);

    if (post.format === "fb_feed") {
      const r = await feedPost(pageId, token, { message, ...(post.link ? { link: post.link } : {}) });
      return { done: true, remoteId: r.id, remoteUrl: `https://www.facebook.com/${r.id}` };
    }

    if (post.format === "fb_photos") {
      const list = images(post);
      if (list.length === 1) {
        const r = await uploadPhoto(pageId, token, list[0], { message });
        const id = r.post_id ?? r.id;
        return { done: true, remoteId: id, remoteUrl: `https://www.facebook.com/${id}` };
      }
      // Album: anh chua dang (published=false) + attached_media
      const ids: string[] = [];
      for (const u of list) ids.push((await uploadPhoto(pageId, token, u, { published: "false" })).id);
      const fields: Record<string, string> = { message };
      ids.forEach((id, i) => (fields[`attached_media[${i}]`] = JSON.stringify({ media_fbid: id })));
      const r = await feedPost(pageId, token, fields);
      return { done: true, remoteId: r.id, remoteUrl: `https://www.facebook.com/${r.id}` };
    }

    if (post.format === "fb_video") {
      const file = await requireVideo(post);
      // Resumable Upload API can user access token (luu o refresh_token_enc khi ket noi)
      const userToken = refreshToken(job.account);
      if (!userToken) throw new SocialError("Thiếu token người dùng Facebook để tải video, hãy kết nối lại.", { auth: true });
      const appId = credentials("facebook").id;
      const session = await requestJson<{ id: string }>(
        graph(`/${appId}/uploads?${new URLSearchParams({ file_name: file.name, file_length: String(file.size), file_type: file.mime, access_token: userToken })}`),
        { method: "POST" },
        metaAuthError,
      );
      const up = await requestJson<{ h: string }>(
        graph(`/${session.id}`),
        { method: "POST", headers: { Authorization: `OAuth ${userToken}`, file_offset: "0" }, body: fileStream(file.abs), duplex: "half", timeoutMs: 30 * 60_000 } as RequestInit,
        metaAuthError,
      );
      const r = await graphPost<{ id: string }>(
        `/${pageId}/videos`,
        token,
        { title: post.title ?? "", description: message, fbuploader_video_file_chunk: up.h },
        "graph-video.facebook.com",
      );
      return { done: true, remoteId: r.id, remoteUrl: `https://www.facebook.com/${pageId}/videos/${r.id}` };
    }

    if (post.format === "fb_reel") {
      const file = await requireVideo(post, { minSec: 3, maxSec: 90 });
      const start = await graphPost<{ video_id: string; upload_url: string }>(`/${pageId}/video_reels`, token, { upload_phase: "start" });
      await requestJson(
        start.upload_url || `https://rupload.facebook.com/video-upload/${META_GRAPH_VERSION()}/${start.video_id}`,
        {
          method: "POST",
          headers: { Authorization: `OAuth ${token}`, offset: "0", file_size: String(file.size), "Content-Type": "application/octet-stream" },
          body: fileStream(file.abs),
          duplex: "half",
          timeoutMs: 30 * 60_000,
        } as RequestInit,
        metaAuthError,
      );
      await graphPost(`/${pageId}/video_reels`, token, {
        upload_phase: "finish",
        video_id: start.video_id,
        video_state: "PUBLISHED",
        description: message,
        ...(post.ai_generated ? { is_ai_generated: "true" } : {}),
      });
      return { done: false, remoteId: start.video_id, state: { video_id: start.video_id }, retryAfterSec: 20, notice: "Facebook đang xử lý reel" };
    }

    invalid(`Facebook không hỗ trợ định dạng ${post.format}.`);
  },

  async poll(job, state): Promise<PublishResult> {
    const token = await job.token();
    const id = String(state.video_id);
    const r = await requestJson<{ permalink_url?: string; status?: { video_status?: string; processing_phase?: { status?: string; error?: { message?: string } }; publishing_phase?: { status?: string; publish_status?: string } } }>(
      graph(`/${id}?${new URLSearchParams({ fields: "status,permalink_url", access_token: token })}`),
      {},
      metaAuthError,
    );
    const s = r.status ?? {};
    if (s.video_status === "error" || s.processing_phase?.status === "error" || s.publishing_phase?.publish_status === "error") {
      throw new SocialError(`Facebook xử lý reel lỗi: ${s.processing_phase?.error?.message ?? s.video_status}`);
    }
    if (s.publishing_phase?.publish_status === "published" || s.publishing_phase?.status === "complete") {
      const url = r.permalink_url ? (r.permalink_url.startsWith("http") ? r.permalink_url : `https://www.facebook.com${r.permalink_url}`) : `https://www.facebook.com/reel/${id}`;
      return { done: true, remoteId: id, remoteUrl: url };
    }
    return { done: false, remoteId: id, state, retryAfterSec: 30 };
  },

  fakeUrl(job, id) {
    return `https://www.facebook.com/${job.account.page_id ?? "page"}/posts/${id}`;
  },
};

/** POST /{page-id}/feed */
function feedPost(pageId: string, token: string, fields: Record<string, string>) {
  return graphPost<{ id: string }>(`/${pageId}/feed`, token, fields);
}
