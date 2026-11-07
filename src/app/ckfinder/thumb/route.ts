import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { getAdmin } from "@/server/auth";
import { STORAGE_DIR } from "@/server/media";
import { absoluteUrl } from "@/lib/origin";

/**
 * GET /ckfinder/thumb?url=/userfiles/image/a.jpg — anh xem truoc cho trinh chon anh.
 * Thu nho giu ti le (toi da 320px), xuat WebP, cache trong storage/.thumbs theo
 * duong dan + thoi diem sua file, nen luoi anh khong phai tai anh goc vai MB.
 */
const SIZE = 320;
const ROOTS = ["userfiles", "uploads"];

export async function GET(req: Request) {
  if (!(await getAdmin())) return new Response("Unauthorized", { status: 401 });
  const url = new URL(req.url).searchParams.get("url") ?? "";
  const rel = decodeURIComponent(url).replace(/^\/+/, "");
  if (!ROOTS.some((r) => rel.startsWith(`${r}/`))) return new Response("Not Found", { status: 404 });

  const original = path.resolve(STORAGE_DIR, rel);
  if (!original.startsWith(path.resolve(STORAGE_DIR) + path.sep)) return new Response("Not Found", { status: 404 });
  const info = await stat(original).catch(() => null);
  if (!info?.isFile()) return new Response("Not Found", { status: 404 });

  const key = createHash("md5").update(`${rel}:${info.mtimeMs}:${SIZE}`).digest("hex");
  const cacheDir = path.join(STORAGE_DIR, ".thumbs", key.slice(0, 2));
  const cachePath = path.join(cacheDir, `${key}.webp`);
  const headers = { "content-type": "image/webp", "cache-control": "private, max-age=31536000, immutable" };

  const cached = await readFile(cachePath).catch(() => null);
  if (cached) return new Response(new Uint8Array(cached), { headers });

  try {
    const sharp = (await import("sharp")).default;
    const buf = await sharp(original, { animated: false })
      .rotate()
      .resize(SIZE, SIZE, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 75 })
      .toBuffer();
    await mkdir(cacheDir, { recursive: true });
    await writeFile(cachePath, buf);
    return new Response(new Uint8Array(buf), { headers });
  } catch {
    // Khong phai anh sharp doc duoc -> tra ve anh goc
    return Response.redirect(absoluteUrl(req, `/${rel}`), 302);
  }
}
