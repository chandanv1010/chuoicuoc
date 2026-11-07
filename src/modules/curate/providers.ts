import "server-only";

/**
 * Bo lay noi dung tu nguon mien phi -> CurateItemInput (chua ghi DB).
 * Moi nguon tu gan giay phep + dong dan nguon, va cac co:
 *  - attribution_required: phai ghi tac gia/nguon khi dang (CC BY, CC BY-SA, Wikimedia...)
 *  - can_modify = false: CC BY-ND -> chi dang nguyen ban, khong cat / chen chu / ghep video
 *  - can_republish = false: bai bao co ban quyen (RSS) -> chi tom tat ngan + link ve bai goc
 * Giay phep phi thuong mai (NC) bi loai ngay tu dau vi web ban hang la muc dich thuong mai.
 */

export type Provider = "openverse" | "wikimedia" | "pexels" | "pixabay" | "rss";
export type CurateKind = "image" | "video" | "article";

export type CurateItemInput = {
  provider: Provider;
  external_id: string;
  kind: CurateKind;
  title: string | null;
  excerpt: string | null;
  page_url: string | null;
  media_url: string | null;
  thumb_url: string | null;
  width: number | null;
  height: number | null;
  duration: number | null;
  author: string | null;
  author_url: string | null;
  license: string;
  license_url: string | null;
  attribution: string;
  attribution_required: boolean;
  can_modify: boolean;
  can_republish: boolean;
  published_at: Date | null;
};

export type SourceRow = { id: bigint; provider: Provider; name: string; query: string | null; media: CurateKind; per_run: number };

export const PROVIDER_LABEL: Record<Provider, string> = {
  openverse: "Openverse (Flickr, Wikimedia... giấy phép CC)",
  wikimedia: "Wikimedia Commons",
  pexels: "Pexels",
  pixabay: "Pixabay",
  rss: "RSS bài viết",
};

/** Nguon nao ho tro loai nao. */
export const PROVIDER_MEDIA: Record<Provider, CurateKind[]> = {
  openverse: ["image"],
  wikimedia: ["image", "video"],
  pexels: ["image", "video"],
  pixabay: ["image", "video"],
  rss: ["article"],
};

export const env = (name: string) => (process.env[name] ?? "").trim();

/** Nguon can key: tra ve ten bien .env con thieu (null = du). */
export function missingKey(p: Provider): string | null {
  if (p === "pexels" && !env("PEXELS_API_KEY")) return "PEXELS_API_KEY";
  if (p === "pixabay" && !env("PIXABAY_API_KEY")) return "PIXABAY_API_KEY";
  return null;
}

/** User-Agent kem ten mien cua site (Wikimedia/Openverse yeu cau UA co thong tin lien he). */
const SITE_URL = (process.env.PUBLIC_BASE_URL || process.env.APP_URL || "").replace(/\/$/, "");
export const CURATE_UA = `WebCore/1.0 (${SITE_URL || "self-hosted"}; content curation)`;
const UA = CURATE_UA;

async function getJson<T>(url: string, headers: Record<string, string> = {}, timeoutMs = 30_000): Promise<T> {
  const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json", ...headers }, signal: AbortSignal.timeout(timeoutMs), cache: "no-store" });
  if (!r.ok) throw new Error(`${new URL(url).host} trả về HTTP ${r.status}`);
  return (await r.json()) as T;
}

const clip = (s: string | null | undefined, n: number) => {
  const t = (s ?? "").replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n - 1).trimEnd() + "…" : t;
};
const stripHtml = (s: string) =>
  s
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/\s+/g, " ")
    .trim();

/** Ma giay phep CC -> {nhan, can ghi nguon, duoc chinh sua, thuong mai}. */
function ccInfo(code: string) {
  const c = code.toLowerCase().replace(/^cc[- ]?/, "").replace(/\s+/g, "-");
  const pd = c === "0" || c === "cc0" || c === "pdm" || c.startsWith("public") || c === "pd";
  return {
    code: pd ? (c === "pdm" || c.startsWith("public") || c === "pd" ? "pdm" : "cc0") : c.replace(/-\d.*$/, ""),
    attribution: !pd,
    modify: !c.includes("nd"),
    commercial: !c.includes("nc"),
  };
}

const LICENSE_NAME: Record<string, string> = {
  cc0: "CC0 (public domain)",
  pdm: "Public domain",
  by: "CC BY",
  "by-sa": "CC BY-SA",
  "by-nd": "CC BY-ND",
  pexels: "Pexels License",
  pixabay: "Pixabay Content License",
  copyrighted: "Bản quyền thuộc tác giả",
};
export const licenseName = (code: string | null) => (code ? LICENSE_NAME[code] ?? code.toUpperCase() : "—");

/* ---------------- Openverse: anh CC tong hop (Flickr, Wikimedia, museum...) ---------------- */
type OvResult = {
  id: string; title: string | null; foreign_landing_url: string | null; url: string; thumbnail: string | null;
  creator: string | null; creator_url: string | null; license: string; license_version: string | null; license_url: string | null;
  provider: string | null; attribution: string | null; width: number | null; height: number | null;
};
async function openverse(s: SourceRow): Promise<CurateItemInput[]> {
  const q = new URLSearchParams({ q: s.query || "lifestyle", license_type: "commercial", page_size: String(Math.min(s.per_run, 50)), mature: "false" });
  // Openverse an danh doi khi tra loi rat cham (40-50 s)
  const d = await getJson<{ results: OvResult[] }>(`https://api.openverse.org/v1/images/?${q}`, {}, 90_000);
  return d.results.flatMap((r) => {
    const lic = ccInfo(r.license);
    if (!lic.commercial) return [];
    const ver = r.license_version && !["cc0", "pdm"].includes(lic.code) ? ` ${r.license_version}` : "";
    return [{
      provider: "openverse" as const, external_id: r.id, kind: "image" as const,
      title: clip(r.title, 300) || null, excerpt: null, page_url: r.foreign_landing_url, media_url: r.url, thumb_url: r.thumbnail ?? r.url,
      width: r.width, height: r.height, duration: null, author: r.creator, author_url: r.creator_url,
      license: lic.code, license_url: r.license_url,
      attribution: `"${clip(r.title, 120) || "Photo"}" by ${r.creator || "unknown"}${r.provider ? ` (${r.provider})` : ""}, ${licenseName(lic.code)}${ver}${r.license_url ? ` – ${r.license_url}` : ""}`,
      attribution_required: lic.attribution, can_modify: lic.modify, can_republish: true, published_at: null,
    }];
  });
}

/* ---------------- Wikimedia Commons: anh + video (webm/ogv) ---------------- */
type WmPage = {
  pageid: number; title: string;
  imageinfo?: { url: string; descriptionurl: string; thumburl?: string; width: number; height: number; mime: string; duration?: number;
    extmetadata?: Record<string, { value: string }> }[];
};
async function wikimedia(s: SourceRow): Promise<CurateItemInput[]> {
  const search = `${s.query || "lifestyle"} filetype:${s.media === "video" ? "video" : "bitmap"}`;
  const q = new URLSearchParams({
    action: "query", format: "json", generator: "search", gsrsearch: search, gsrnamespace: "6", gsrlimit: String(Math.min(s.per_run, 50)),
    prop: "imageinfo", iiprop: "url|size|mime|extmetadata", iiurlwidth: "640", origin: "*",
  });
  const d = await getJson<{ query?: { pages: Record<string, WmPage> } }>(`https://commons.wikimedia.org/w/api.php?${q}`);
  return Object.values(d.query?.pages ?? {}).flatMap((p) => {
    const ii = p.imageinfo?.[0];
    if (!ii) return [];
    const m = ii.extmetadata ?? {};
    const v = (k: string) => (m[k]?.value ? stripHtml(m[k].value) : "");
    const lic = ccInfo(v("LicenseShortName") || v("License") || "");
    // chi lay giay phep tu do ro rang
    if (!lic.commercial || !/^(cc0|pdm|by|by-sa|by-nd)$/.test(lic.code)) return [];
    const name = p.title.replace(/^File:/, "").replace(/\.[a-z0-9]+$/i, "");
    const author = v("Artist") || null;
    const kind = ii.mime.startsWith("video/") ? ("video" as const) : ("image" as const);
    return [{
      provider: "wikimedia" as const, external_id: String(p.pageid), kind,
      title: clip(v("ObjectName") || name, 300), excerpt: clip(v("ImageDescription"), 500) || null,
      page_url: ii.descriptionurl, media_url: ii.url.split("?")[0], thumb_url: ii.thumburl ?? null,
      width: ii.width || null, height: ii.height || null, duration: ii.duration ? Math.round(ii.duration) : null,
      author: clip(author, 250) || null, author_url: null,
      license: lic.code, license_url: v("LicenseUrl") || null,
      attribution: `"${clip(name, 120)}" by ${clip(author, 120) || "unknown"}, ${v("LicenseShortName") || licenseName(lic.code)}, via Wikimedia Commons – ${ii.descriptionurl}`,
      attribution_required: lic.attribution || v("AttributionRequired") === "true", can_modify: lic.modify, can_republish: true, published_at: null,
    }];
  });
}

/* ---------------- Pexels: anh + video mp4, Pexels License (khong bat buoc ghi nguon nhung API yeu cau link ve Pexels) ---------------- */
type PxPhoto = { id: number; width: number; height: number; url: string; alt: string | null; photographer: string; photographer_url: string; src: { original: string; large2x: string; medium: string } };
type PxVideo = { id: number; width: number; height: number; url: string; duration: number; image: string; user: { name: string; url: string };
  video_files: { link: string; width: number | null; height: number | null; file_type: string; quality: string | null }[] };
async function pexels(s: SourceRow): Promise<CurateItemInput[]> {
  const headers = { Authorization: env("PEXELS_API_KEY") };
  const q = new URLSearchParams({ query: s.query || "lifestyle", per_page: String(Math.min(s.per_run, 80)) });
  const base = { provider: "pexels" as const, license: "pexels", license_url: "https://www.pexels.com/license/", attribution_required: false, can_modify: true, can_republish: true, published_at: null, excerpt: null };
  if (s.media === "video") {
    const d = await getJson<{ videos: PxVideo[] }>(`https://api.pexels.com/videos/search?${q}`, headers);
    return d.videos.flatMap((v) => {
      // ban mp4 rong <= 1920 lon nhat (du cho Reels/TikTok, khong qua nang)
      const f = v.video_files.filter((x) => x.file_type === "video/mp4" && (x.width ?? 0) <= 1920).sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0];
      if (!f) return [];
      return [{ ...base, external_id: `v${v.id}`, kind: "video" as const, title: titleFromSlug(v.url), page_url: v.url, media_url: f.link, thumb_url: v.image,
        width: f.width, height: f.height, duration: v.duration, author: v.user.name, author_url: v.user.url,
        attribution: `Video by ${v.user.name} on Pexels – ${v.url}` }];
    });
  }
  const d = await getJson<{ photos: PxPhoto[] }>(`https://api.pexels.com/v1/search?${q}`, headers);
  return d.photos.map((p) => ({ ...base, external_id: `p${p.id}`, kind: "image" as const, title: clip(p.alt, 300) || titleFromSlug(p.url), page_url: p.url,
    media_url: p.src.large2x, thumb_url: p.src.medium, width: p.width, height: p.height, duration: null, author: p.photographer, author_url: p.photographer_url,
    attribution: `Photo by ${p.photographer} on Pexels – ${p.url}` }));
}
const titleFromSlug = (u: string) => {
  const m = /\/(?:photo|video)\/([a-z0-9-]+?)-\d+\/?$/.exec(u);
  return m ? m[1].replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase()) : null;
};

/* ---------------- Pixabay: anh + video mp4, Pixabay Content License (phai tai ve, khong hotlink) ---------------- */
type PbHit = { id: number; pageURL: string; tags: string; user: string; user_id: number; webformatURL?: string; largeImageURL?: string; previewURL?: string; imageWidth?: number; imageHeight?: number;
  duration?: number; videos?: Record<string, { url: string; width: number; height: number; thumbnail?: string }> };
async function pixabay(s: SourceRow): Promise<CurateItemInput[]> {
  const q = new URLSearchParams({ key: env("PIXABAY_API_KEY"), q: s.query || "lifestyle", per_page: String(Math.max(3, Math.min(s.per_run, 200))), safesearch: "true" });
  const video = s.media === "video";
  const d = await getJson<{ hits: PbHit[] }>(`https://pixabay.com/api/${video ? "videos/" : ""}?${q}`);
  return d.hits.flatMap((h): CurateItemInput[] => {
    const author_url = `https://pixabay.com/users/${encodeURIComponent(h.user)}-${h.user_id}/`;
    const base = { provider: "pixabay" as const, page_url: h.pageURL, title: clip(h.tags, 300), excerpt: null, author: h.user, author_url,
      license: "pixabay", license_url: "https://pixabay.com/service/license-summary/", attribution_required: false, can_modify: true, can_republish: true, published_at: null };
    if (video) {
      const f = h.videos?.large?.url ? h.videos.large : h.videos?.medium;
      if (!f?.url) return [];
      return [{ ...base, external_id: `v${h.id}`, kind: "video" as const, media_url: f.url, thumb_url: f.thumbnail ?? null, width: f.width, height: f.height,
        duration: h.duration ?? null, attribution: `Video by ${h.user} from Pixabay – ${h.pageURL}` }];
    }
    return [{ ...base, external_id: `p${h.id}`, kind: "image" as const, media_url: h.largeImageURL ?? h.webformatURL ?? null, thumb_url: h.webformatURL ?? h.previewURL ?? null,
      width: h.imageWidth ?? null, height: h.imageHeight ?? null, duration: null, attribution: `Image by ${h.user} from Pixabay – ${h.pageURL}` }];
  });
}

/* ---------------- RSS / Atom: bai viet co ban quyen -> chi tieu de + tom tat ngan + link ---------------- */
const tag = (xml: string, name: string) => {
  const m = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i").exec(xml);
  return m ? m[1].replace(/^<!\[CDATA\[|\]\]>$/g, "").trim() : "";
};
const attr = (xml: string, name: string, a: string) => new RegExp(`<${name}\\b[^>]*\\b${a}="([^"]+)"`, "i").exec(xml)?.[1] ?? "";

async function rss(s: SourceRow): Promise<CurateItemInput[]> {
  if (!s.query || !/^https?:\/\//.test(s.query)) throw new Error("Nguồn RSS cần URL feed (http/https)");
  const r = await fetch(s.query, { headers: { "User-Agent": UA, Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml" }, signal: AbortSignal.timeout(20_000), cache: "no-store" });
  if (!r.ok) throw new Error(`Feed trả về HTTP ${r.status}`);
  const xml = await r.text();
  const site = tag(xml.split(/<item|<entry/i)[0], "title") || new URL(s.query).host;
  const blocks = xml.match(/<item\b[\s\S]*?<\/item>|<entry\b[\s\S]*?<\/entry>/gi) ?? [];
  return blocks.slice(0, s.per_run).flatMap((b) => {
    const link = tag(b, "link") || attr(b, "link", "href");
    if (!/^https?:\/\//.test(link)) return [];
    const title = stripHtml(tag(b, "title"));
    // tom tat <= 280 ky tu: du de gioi thieu, khong chep lai bai (trich dan ngan + link la cach an toan)
    const excerpt = clip(stripHtml(tag(b, "description") || tag(b, "summary") || tag(b, "content")), 280);
    const img = attr(b, "media:content", "url") || attr(b, "media:thumbnail", "url") || attr(b, "enclosure", "url") || null;
    const date = new Date(tag(b, "pubDate") || tag(b, "published") || tag(b, "updated"));
    const author = stripHtml(tag(b, "dc:creator") || tag(tag(b, "author"), "name") || tag(b, "author")) || null;
    return [{
      provider: "rss" as const, external_id: clip(tag(b, "guid") || tag(b, "id") || link, 190), kind: "article" as const,
      title: clip(title, 300), excerpt: excerpt || null, page_url: link, media_url: null, thumb_url: img,
      width: null, height: null, duration: null, author, author_url: null,
      license: "copyrighted", license_url: null,
      attribution: `Source: ${clip(title, 150)}${author ? ` – ${author}` : ""}, ${clip(stripHtml(site), 80)} – ${link}`,
      attribution_required: true, can_modify: false, can_republish: false,
      published_at: Number.isNaN(date.getTime()) ? null : date,
    }];
  });
}

export async function fetchSource(s: SourceRow): Promise<CurateItemInput[]> {
  const key = missingKey(s.provider);
  if (key) throw new Error(`Thiếu ${key} trong .env`);
  switch (s.provider) {
    case "openverse": return openverse(s);
    case "wikimedia": return wikimedia(s);
    case "pexels": return pexels(s);
    case "pixabay": return pixabay(s);
    case "rss": return rss(s);
  }
}
