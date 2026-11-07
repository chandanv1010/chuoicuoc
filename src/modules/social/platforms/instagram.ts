import "server-only";
import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { META_GRAPH_VERSION } from "../config";
import { invalid, requestJson, SocialError } from "../http";
import { publicJpegUrl } from "../media";
import { metaAuthError } from "../oauth";
import { captionOf, checkImageCount, images, requireVideo, type Adapter, type PublishJob, type PublishResult } from "./base";

/**
 * Instagram Graph API (Facebook Login, Page access token cua Page lien ket).
 * Tai lieu: https://developers.facebook.com/docs/instagram-platform/content-publishing
 *  1. Tao container: POST /{ig-user-id}/media (image_url | media_type=CAROUSEL + children | media_type=REELS)
 *  2. Poll GET /{container-id}?fields=status_code -> FINISHED (IN_PROGRESS / ERROR / EXPIRED)
 *  3. POST /{ig-user-id}/media_publish creation_id=...
 *  - Anh: chi JPEG, phai o URL cong khai -> /social/media/jpg/... tren PUBLIC_BASE_URL
 *  - Carousel: toi da 20 muc (anh/video), tinh la 1 bai
 *  - Reel: upload_type=resumable + POST rupload.facebook.com/ig-api-upload/{ver}/{container-id}
 *    (gui byte tu o dia, khong can URL cong khai)
 *  - Han muc: 100 bai API / 24h; kiem tra GET /{ig-user-id}/content_publishing_limit
 *  - Caption toi da 2200 ky tu, 30 hashtag.
 */

const graph = (path: string) => `https://graph.facebook.com/${META_GRAPH_VERSION()}${path}`;

function igId(job: PublishJob) {
  const id = job.account.ig_user_id;
  if (!id) invalid("Tài khoản Instagram chưa liên kết (cần IG Business/Creator gắn với Page).");
  return id;
}

async function create(ig: string, token: string, fields: Record<string, string>) {
  return requestJson<{ id: string; uri?: string }>(graph(`/${ig}/media`), { method: "POST", body: new URLSearchParams({ ...fields, access_token: token }) }, metaAuthError);
}

function checkCaption(caption: string) {
  if (caption.length > 2200) invalid(`Instagram: caption dài ${caption.length} ký tự, tối đa 2200.`);
  const tags = caption.match(/#[\p{L}\p{N}_]+/gu) ?? [];
  if (tags.length > 30) invalid(`Instagram: tối đa 30 hashtag (đang có ${tags.length}).`);
}

export const instagram: Adapter = {
  platform: "instagram",

  async validate(job) {
    const { post } = job;
    igId(job);
    checkCaption(captionOf(post));
    switch (post.format) {
      case "ig_image":
      case "ig_carousel":
        checkImageCount(post);
        // Nem loi ro rang neu PUBLIC_BASE_URL la localhost
        for (const u of images(post)) publicJpegUrl(u, "Instagram");
        break;
      case "ig_reel":
        await requireVideo(post, { minSec: 3, maxSec: 15 * 60 });
        break;
      default:
        invalid(`Instagram không hỗ trợ định dạng ${post.format}.`);
    }
  },

  async publish(job): Promise<PublishResult> {
    const { post } = job;
    const ig = igId(job);
    const token = await job.token();
    const caption = captionOf(post);

    // Han muc dang bai 24h
    try {
      const lim = await requestJson<{ data?: { quota_usage?: number; config?: { quota_total?: number } }[] }>(
        graph(`/${ig}/content_publishing_limit?${new URLSearchParams({ fields: "quota_usage,config", access_token: token })}`),
        {},
        metaAuthError,
      );
      const d = lim.data?.[0];
      if (d?.config?.quota_total && (d.quota_usage ?? 0) >= d.config.quota_total) {
        throw new SocialError(`Instagram: đã dùng hết hạn mức ${d.config.quota_total} bài/24 giờ, sẽ thử lại sau.`, { retryable: true });
      }
    } catch (e) {
      if (e instanceof SocialError && (e.auth || e.retryable)) throw e;
      // loi doc han muc khong chan dang bai
    }

    let containerId: string;
    if (post.format === "ig_image") {
      containerId = (await create(ig, token, { image_url: publicJpegUrl(images(post)[0], "Instagram"), caption })).id;
    } else if (post.format === "ig_carousel") {
      const children: string[] = [];
      for (const u of images(post)) children.push((await create(ig, token, { image_url: publicJpegUrl(u, "Instagram"), is_carousel_item: "true" })).id);
      containerId = (await create(ig, token, { media_type: "CAROUSEL", children: children.join(","), caption })).id;
    } else if (post.format === "ig_reel") {
      const file = await requireVideo(post, { minSec: 3, maxSec: 15 * 60 });
      const c = await create(ig, token, { media_type: "REELS", upload_type: "resumable", caption, share_to_feed: "true" });
      await requestJson(
        c.uri || `https://rupload.facebook.com/ig-api-upload/${META_GRAPH_VERSION()}/${c.id}`,
        {
          method: "POST",
          headers: { Authorization: `OAuth ${token}`, offset: "0", file_size: String(file.size) },
          body: Readable.toWeb(createReadStream(file.abs)) as unknown as ReadableStream<Uint8Array>,
          duplex: "half",
          timeoutMs: 30 * 60_000,
        } as RequestInit,
        metaAuthError,
      );
      containerId = c.id;
    } else {
      invalid(`Instagram không hỗ trợ định dạng ${post.format}.`);
    }
    return { done: false, remoteId: containerId, state: { container_id: containerId }, retryAfterSec: post.format === "ig_reel" ? 30 : 5, notice: "Instagram đang xử lý" };
  },

  async poll(job, state): Promise<PublishResult> {
    const ig = igId(job);
    const token = await job.token();
    const id = String(state.container_id);
    const s = await requestJson<{ status_code?: string; status?: string }>(graph(`/${id}?${new URLSearchParams({ fields: "status_code,status", access_token: token })}`), {}, metaAuthError);
    if (s.status_code === "ERROR" || s.status_code === "EXPIRED") throw new SocialError(`Instagram xử lý media lỗi (${s.status_code}): ${s.status ?? ""}`);
    if (s.status_code !== "FINISHED") return { done: false, remoteId: id, state, retryAfterSec: 30 };
    const pub = await requestJson<{ id: string }>(graph(`/${ig}/media_publish`), { method: "POST", body: new URLSearchParams({ creation_id: id, access_token: token }) }, metaAuthError);
    let url: string | null = null;
    try {
      url = (await requestJson<{ permalink?: string }>(graph(`/${pub.id}?${new URLSearchParams({ fields: "permalink", access_token: token })}`), {}, metaAuthError)).permalink ?? null;
    } catch {
      // permalink khong bat buoc
    }
    return { done: true, remoteId: pub.id, remoteUrl: url };
  },

  fakeUrl(_job, id) {
    return `https://www.instagram.com/p/${id}/`;
  },
};
