import "server-only";
import sharp from "sharp";
import { db } from "@/lib/db";
import { getCurrentLanguage } from "@/lib/language";
import { slugify } from "@/lib/slug";
import { saveUpload } from "@/server/media";
import { createPost } from "@/modules/post/post";
import { CURATE_UA, env, licenseName } from "./providers";
import { markUsed, type CurateItem } from "./store";

/**
 * Duyet muc -> bai viet NHAP (publish = 1) trong nhom CURATE_POST_CATALOGUE_ID (mac dinh 24 "News"),
 * kem dong dan nguon trong noi dung + mo ta (mo ta la caption mac dinh khi dang mang xa hoi).
 * Admin sua chu, bat "Dang len mang xa hoi" + dat lich ngay tren trang sua bai, roi bat hoat dong.
 */

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const link = (href: string | null, text: string) => (href ? `<a href="${esc(href)}" target="_blank" rel="nofollow noopener">${esc(text)}</a>` : esc(text));

const PROVIDER_SITE: Record<string, [string, string]> = {
  openverse: ["Openverse", "https://openverse.org"],
  wikimedia: ["Wikimedia Commons", "https://commons.wikimedia.org"],
  pexels: ["Pexels", "https://www.pexels.com"],
  pixabay: ["Pixabay", "https://pixabay.com"],
};

/** Dong dan nguon dang HTML (trong bai) — TASL: Title, Author, Source, License. */
export function creditHtml(i: CurateItem) {
  if (i.kind === "article") {
    return `<p class="source-credit">Source: ${link(i.page_url, i.title || i.page_url || "original article")}${i.author ? ` by ${esc(i.author)}` : ""}.</p>`;
  }
  const [site, siteUrl] = PROVIDER_SITE[i.provider] ?? [i.provider, null];
  const what = i.kind === "video" ? "Video" : "Photo";
  const lic = i.license_url ? link(i.license_url, licenseName(i.license)) : esc(licenseName(i.license));
  return `<p class="source-credit">${what}: ${link(i.page_url, i.title || "original")} by ${link(i.author_url, i.author || "unknown")}, via ${link(siteUrl, site)}. License: ${lic}.</p>`;
}

/** Dong dan nguon dang chu (caption mang xa hoi). */
export function creditText(i: CurateItem) {
  if (i.kind === "article") return `Source: ${i.title ?? ""}${i.author ? ` – ${i.author}` : ""} ${i.page_url ?? ""}`.trim();
  const site = PROVIDER_SITE[i.provider]?.[0] ?? i.provider;
  const what = i.kind === "video" ? "Video" : "Photo";
  return `${what}: ${i.author || "unknown"} via ${site} (${licenseName(i.license)})${i.attribution_required && i.page_url ? ` ${i.page_url}` : ""}`;
}

async function download(url: string, maxBytes: number) {
  const r = await fetch(url, { headers: { "User-Agent": CURATE_UA }, signal: AbortSignal.timeout(120_000) });
  if (!r.ok) throw new Error(`Tải file thất bại: HTTP ${r.status}`);
  const len = Number(r.headers.get("content-length") || 0);
  if (len > maxBytes) throw new Error(`File quá lớn (${Math.round(len / 1e6)} MB)`);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length > maxBytes) throw new Error(`File quá lớn (${Math.round(buf.length / 1e6)} MB)`);
  return buf;
}

const folder = () => `/curate/${new Date().toISOString().slice(0, 7)}`;
const baseName = (i: CurateItem) => `${i.provider}-${slugify(i.title || "media").slice(0, 50) || "media"}-${i.external_id.replace(/[^a-z0-9]/gi, "").slice(-12)}`;

/** Anh -> JPEG <= 2048 px trong thu vien /userfiles/image/curate/<thang>/ (dang MXH can file tren may chu cua minh). */
async function saveImage(i: CurateItem, url: string) {
  const buf = await download(url, 40e6);
  const jpg = await sharp(buf, { failOn: "none" }).rotate().resize({ width: 2048, height: 2048, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 88 }).toBuffer();
  return (await saveUpload("Images", folder(), new File([new Uint8Array(jpg)], `${baseName(i)}.jpg`))).url;
}

async function uniqueCanonical(base: string) {
  const root = (base || "bai-viet").slice(0, 80);
  for (let n = 0; n < 50; n++) {
    const c = n ? `${root}-${n + 1}` : root;
    const hit = await db.$queryRaw<{ id: bigint }[]>`SELECT id FROM routers WHERE canonical = ${c} LIMIT 1`;
    if (!hit.length) return c;
  }
  return `${root}-${Date.now()}`;
}

export type DraftResult = { postId: bigint; warnings: string[] };

export async function createDraftFromItem(i: CurateItem, userId: bigint): Promise<DraftResult> {
  const warnings: string[] = [];
  let image = "";
  let video = "";
  let mediaHtml = "";

  if (i.kind === "image" && i.media_url) {
    image = await saveImage(i, i.media_url);
    mediaHtml = `<figure><img src="${esc(image)}" alt="${esc(i.title || "image")}"><figcaption>${creditHtml(i)}</figcaption></figure>`;
  } else if (i.kind === "video" && i.media_url) {
    if (/\.mp4(\?|$)/i.test(i.media_url) || i.provider === "pexels" || i.provider === "pixabay") {
      const buf = await download(i.media_url, 300e6);
      video = (await saveUpload("Images", folder(), new File([new Uint8Array(buf)], `${baseName(i)}.mp4`))).url;
      mediaHtml = `<figure><video src="${esc(video)}" controls playsinline preload="metadata"></video><figcaption>${creditHtml(i)}</figcaption></figure>`;
    } else {
      // Wikimedia chi co webm/ogv: Facebook/Instagram/TikTok can mp4 -> chi nhung tren web, admin tu chuyen sang mp4 neu muon dang MXH
      mediaHtml = `<figure><video src="${esc(i.media_url)}" controls playsinline preload="metadata"></video><figcaption>${creditHtml(i)}</figcaption></figure>`;
      warnings.push("Video gốc là WebM/OGV (Wikimedia), mạng xã hội cần MP4: chỉ nhúng trên web, muốn đăng MXH thì đổi sang MP4 rồi gắn vào ô Video.");
    }
    if (i.thumb_url) image = await saveImage(i, i.thumb_url).catch(() => "");
  } else if (i.kind === "article" && i.thumb_url) {
    // anh dai dien cua bai bao cung co ban quyen: khong tai ve
    warnings.push("Ảnh đại diện của bài gốc có bản quyền nên không lấy về; hãy chọn ảnh của bạn cho bài này.");
  }

  const credit = creditText(i);
  const title = i.title || (i.kind === "article" ? "Bài viết tham khảo" : "Inspiration");
  let content: string;
  let description: string;
  if (i.kind === "article") {
    content =
      `<p><em>[Viết nhận xét / nội dung của bạn ở đây. Không chép lại bài gốc; chỉ trích ngắn và dẫn link.]</em></p>` +
      (i.excerpt ? `<blockquote>${esc(i.excerpt)}</blockquote>` : "") +
      creditHtml(i);
    description = `${i.excerpt ?? ""}\n\nRead more: ${i.page_url ?? ""}`.trim();
  } else {
    content = mediaHtml + (i.excerpt ? `<p>${esc(i.excerpt)}</p>` : "");
    description = `${title}\n\n${credit}`;
  }
  if (!i.can_modify) warnings.push("Giấy phép CC BY-ND: chỉ đăng nguyên bản, không cắt ghép, chèn chữ hay logo lên ảnh/video.");

  // ngoai request (script / worker) khong co cookie ngon ngu -> ngon ngu 1 (English)
  const languageId = await getCurrentLanguage().then((l) => l.id).catch(() => BigInt(1));
  const catalogue = env("CURATE_POST_CATALOGUE_ID") || "24";
  const post = await createPost(
    {
      name: title.slice(0, 250),
      canonical: await uniqueCanonical(slugify(title)),
      description,
      content,
      meta_title: title.slice(0, 250),
      meta_description: (i.kind === "article" ? i.excerpt ?? title : title).slice(0, 300),
      image,
      video,
      publish: "1",
      post_catalogue_id: catalogue,
      catalogue: [catalogue],
      recommend: "1",
      post_type: "post",
    },
    languageId,
    userId,
  );
  await markUsed(i.id, post.id, image || video || null, userId);
  return { postId: post.id, warnings };
}
