import { readFile } from "node:fs/promises";
import { storagePathOf } from "@/modules/social/media";

/**
 * GET /social/media/jpg/userfiles/... — ban JPEG cua anh trong thu vien.
 * Instagram (va anh TikTok) chi nhan JPEG qua URL cong khai; anh PNG/WebP duoc chuyen bang sharp.
 * Chi phuc vu file da cong khai san o /userfiles, /uploads.
 */
export async function GET(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const segs = (await params).path;
  const p = storagePathOf(`/${segs.map((s) => encodeURIComponent(decodeURIComponent(s))).join("/")}`);
  if (!p || !/\.(png|webp|gif|jpe?g|bmp)$/i.test(p.abs)) return new Response("404 | Not Found", { status: 404 });
  let data: Buffer;
  try {
    data = await readFile(p.abs);
  } catch {
    return new Response("404 | Not Found", { status: 404 });
  }
  const sharp = (await import("sharp")).default;
  // ?w=&h=: thu nho vao khung, khong phong to (TikTok anh toi da 1080p)
  const sp = new URL(req.url).searchParams;
  const w = Math.min(4096, Number(sp.get("w")) || 0);
  const h = Math.min(4096, Number(sp.get("h")) || 0);
  let img = sharp(data, { animated: false }).rotate().flatten({ background: "#ffffff" });
  // ?pad=1: dat anh vao dung khung w x h nen trang (TikTok tu choi album tron nhieu kho anh)
  if (w > 0 && h > 0) img = sp.get("pad") === "1" ? img.resize(w, h, { fit: "contain", background: "#ffffff" }) : img.resize(w, h, { fit: "inside", withoutEnlargement: true });
  const jpg = await img.jpeg({ quality: 90 }).toBuffer();
  return new Response(new Uint8Array(jpg), { headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=86400" } });
}
