import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { STORAGE_DIR } from "@/server/media";
import { absoluteUrl } from "@/lib/origin";

/**
 * GET /thumb?src=...&w=...&h=... — App\Http\Controllers\ImageResizerController@resize.
 *  - khong co src -> 404; khong co w/h -> redirect ve src
 *  - anh goc khong ton tai -> 404; loai anh khac JPEG/PNG/GIF -> 415
 *  - cache trong storage/image-cache/md5(src.w.h).ext (Laravel: public/image-cache)
 *  - loi bat ky -> redirect ve src
 * Anh goc: public/<src> cua Laravel = storage/<src> (uploads, userfiles) ben Next.
 */
const TYPES: Record<string, string> = { jpeg: "image/jpeg", png: "image/png", gif: "image/gif" };

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const src = sp.get("src");
  if (!src) return new Response("Image not found", { status: 404 });
  const width = sp.get("w");
  const height = sp.get("h");
  const redirect = () => new Response(null, { status: 302, headers: { location: absoluteUrl(req, src).toString() } });
  if (!width && !height) return redirect();

  try {
    const root = path.resolve(STORAGE_DIR);
    // public/ cua Laravel = storage/ (uploads, userfiles) + public/ (backend, vendor...) ben Next
    let original = "";
    for (const base of [root, path.resolve(/*turbopackIgnore: true*/ process.cwd(), "public")]) {
      const p = path.resolve(base, src.replace(/^\/+/, ""));
      if (!p.startsWith(base + path.sep)) continue;
      const info = await stat(p).catch(() => null);
      if (info?.isFile()) {
        original = p;
        break;
      }
    }
    if (!original) return new Response("Image not found", { status: 404 });

    const ext = path.extname(path.basename(src)).slice(1);
    const cacheDir = path.join(root, "image-cache");
    const cachePath = path.join(cacheDir, `${createHash("md5").update(`${src}${width ?? ""}${height ?? ""}`).digest("hex")}.${ext}`);
    // Trinh duyet giu anh 7 ngay (URL gom src + kich thuoc), het han thi van dung ban cu trong luc tai lai
    const send = (buf: Buffer, contentType: string) =>
      new Response(new Uint8Array(buf), {
        headers: { "content-type": contentType, "cache-control": "public, max-age=604800, stale-while-revalidate=86400" },
      });

    // Co cache thi tra ngay, khong mo anh goc (anh goc 1-2MB, doc metadata moi lan rat cham)
    const cached = await readFile(cachePath).catch(() => null);
    const byExt: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif" };
    if (cached && byExt[ext.toLowerCase()]) return send(cached, byExt[ext.toLowerCase()]);

    const sharp = (await import("sharp")).default;
    const meta = await sharp(original).metadata();
    const type = meta.format === "jpeg" || meta.format === "png" || meta.format === "gif" ? meta.format : null;
    if (cached) return send(cached, type ? TYPES[type] : "application/octet-stream");
    if (!type) return new Response("Unsupported image type", { status: 415 });
    await mkdir(cacheDir, { recursive: true });

    const ow = meta.width ?? 0;
    const oh = meta.height ?? 0;
    let nw: number;
    let nh: number;
    if (width && height) {
      nw = Number(width);
      nh = Number(height);
    } else if (width) {
      nw = Number(width);
      nh = Math.round(oh * (nw / ow));
    } else {
      nh = Number(height);
      nw = Math.round(ow * (nh / oh));
    }
    // imagecopyresampled: keo gian dung kich thuoc (khong giu ti le khi co ca w va h)
    let img = sharp(original).resize(Math.trunc(nw), Math.trunc(nh), { fit: "fill" });
    // mozjpeg q82: nhe hon ~40% so voi q90, mat thuong khong thay khac
    if (type === "jpeg") img = img.jpeg({ quality: 82, mozjpeg: true, progressive: true });
    else if (type === "png") img = img.png({ compressionLevel: 9 });
    else img = img.gif();
    const out = await img.toBuffer();
    await writeFile(cachePath, out);
    return send(out, TYPES[type]);
  } catch {
    return redirect();
  }
}
