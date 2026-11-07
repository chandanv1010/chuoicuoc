import "server-only";
import { open, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { STORAGE_DIR } from "@/server/media";
import { publicBaseUrl, publicUrlProblem } from "./config";
import { invalid } from "./http";

/**
 * Media cua bai dang: anh/video trong thu vien (storage/userfiles -> /userfiles/...).
 * Uu tien gui byte tu o dia (khong can URL cong khai); nen tang nao bat buoc URL
 * (Instagram, anh TikTok) thi dung PUBLIC_BASE_URL.
 */

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
};

export function mimeOf(file: string) {
  return MIME[path.extname(file).toLowerCase()] ?? "application/octet-stream";
}

/** "/userfiles/image/a b.jpg" | "http(s)://host/userfiles/..." -> duong dan tuong doi trong storage. */
export function storagePathOf(url: string): { rel: string; abs: string } | null {
  let p = url.trim();
  if (/^https?:\/\//i.test(p)) {
    try {
      p = new URL(p).pathname;
    } catch {
      return null;
    }
  }
  p = p.split(/[?#]/)[0];
  try {
    p = decodeURIComponent(p);
  } catch {
    return null;
  }
  const m = p.match(/^\/(userfiles|uploads)\/(.+)$/);
  if (!m) return null;
  const root = path.join(STORAGE_DIR, m[1]);
  const abs = path.resolve(root, m[2]);
  if (!abs.startsWith(root + path.sep)) return null;
  return { rel: `${m[1]}/${m[2]}`, abs };
}

export type LocalFile = { abs: string; name: string; size: number; mime: string };

export async function localFile(url: string): Promise<LocalFile> {
  const p = storagePathOf(url);
  if (!p) invalid(`File "${url}" không nằm trong thư viện (/userfiles/...) nên không tải lên được.`);
  try {
    const s = await stat(p.abs);
    if (!s.isFile()) throw new Error();
    return { abs: p.abs, name: path.basename(p.abs), size: s.size, mime: mimeOf(p.abs) };
  } catch {
    return invalid(`Không tìm thấy file ${url} trong thư viện.`);
  }
}

export async function readBytes(url: string) {
  const f = await localFile(url);
  return { ...f, data: await readFile(f.abs) };
}

/** Doc mot doan byte (upload theo chunk). */
export async function readChunk(abs: string, start: number, length: number) {
  const fh = await open(abs, "r");
  try {
    const buf = Buffer.alloc(length);
    const { bytesRead } = await fh.read(buf, 0, length, start);
    return buf.subarray(0, bytesRead);
  } finally {
    await fh.close();
  }
}

function encodePath(rel: string) {
  return rel.split("/").map(encodeURIComponent).join("/");
}

/** URL cong khai cua file; loi ro rang neu PUBLIC_BASE_URL la localhost. */
export function publicUrl(url: string, platformLabel: string): string {
  const problem = publicUrlProblem();
  if (problem) invalid(`${platformLabel} cần media ở URL công khai HTTPS. ${problem}`);
  const p = storagePathOf(url);
  if (!p) {
    if (/^https:\/\//i.test(url)) return url;
    invalid(`Không tạo được URL công khai cho ${url}.`);
  }
  return `${publicBaseUrl()}/${encodePath(p.rel)}`;
}

/**
 * URL cong khai ban JPEG cua anh (Instagram chi nhan JPEG): route /social/media/jpg/<duong-dan>
 * tu chuyen PNG/WebP sang JPEG bang sharp.
 */
export function publicJpegUrl(url: string, platformLabel: string, fit?: { w: number; h: number; pad?: boolean }): string {
  const problem = publicUrlProblem();
  if (problem) invalid(`${platformLabel} cần ảnh ở URL công khai HTTPS. ${problem}`);
  const p = storagePathOf(url);
  if (!p) invalid(`Ảnh ${url} không nằm trong thư viện nên không chuyển sang JPEG được.`);
  // fit: thu nho vao khung (TikTok anh toi da 1080p) -> luon qua route chuyen doi
  if (fit) return `${publicBaseUrl()}/social/media/jpg/${encodePath(p.rel)}?w=${fit.w}&h=${fit.h}${fit.pad ? "&pad=1" : ""}`;
  if (/\.jpe?g$/i.test(p.rel)) return `${publicBaseUrl()}/${encodePath(p.rel)}`;
  return `${publicBaseUrl()}/social/media/jpg/${encodePath(p.rel)}`;
}

export type VideoInfo = { duration: number | null; width: number | null; height: number | null };

/**
 * Doc thoi luong (mvhd) va kich thuoc (tkhd cua track hinh) tu file MP4/MOV,
 * khong can ffprobe. Chi doc phan dau/cuoi file de tim box moov.
 */
export async function videoInfo(abs: string): Promise<VideoInfo> {
  const info: VideoInfo = { duration: null, width: null, height: null };
  const fh = await open(abs, "r");
  try {
    const { size } = await fh.stat();
    const readAt = async (pos: number, len: number) => {
      const b = Buffer.alloc(len);
      const { bytesRead } = await fh.read(b, 0, len, pos);
      return b.subarray(0, bytesRead);
    };
    // tim moov o cap cao nhat
    let pos = 0;
    let moov: Buffer | null = null;
    while (pos + 8 <= size) {
      const h = await readAt(pos, 16);
      let boxSize = h.readUInt32BE(0);
      const type = h.toString("latin1", 4, 8);
      let header = 8;
      if (boxSize === 1) {
        boxSize = Number(h.readBigUInt64BE(8));
        header = 16;
      } else if (boxSize === 0) boxSize = size - pos;
      if (boxSize < header) break;
      if (type === "moov") {
        moov = await readAt(pos + header, Math.min(boxSize - header, 64 * 1024 * 1024));
        break;
      }
      pos += boxSize;
    }
    if (!moov) return info;
    const walk = (buf: Buffer) => {
      let p = 0;
      while (p + 8 <= buf.length) {
        const s = buf.readUInt32BE(p);
        const t = buf.toString("latin1", p + 4, p + 8);
        if (s < 8 || p + s > buf.length) break;
        const body = buf.subarray(p + 8, p + s);
        if (t === "mvhd") {
          const v = body[0];
          const timescale = v === 1 ? body.readUInt32BE(20) : body.readUInt32BE(12);
          const dur = v === 1 ? Number(body.readBigUInt64BE(24)) : body.readUInt32BE(16);
          if (timescale) info.duration = dur / timescale;
        } else if (t === "tkhd") {
          const w = body.readUInt32BE(body.length - 8) / 65536;
          const hgt = body.readUInt32BE(body.length - 4) / 65536;
          if (w > 0 && hgt > 0 && info.width === null) {
            // ma tran xoay 90 do (video quay doc tren dien thoai): doi chieu
            const v = body[0];
            const mOff = v === 1 ? 4 + 8 + 8 + 4 + 4 + 8 + 8 + 2 + 2 + 2 + 2 : 4 + 4 + 4 + 4 + 4 + 4 + 8 + 2 + 2 + 2 + 2;
            const a = body.readInt32BE(mOff);
            const rotated = a === 0;
            info.width = rotated ? hgt : w;
            info.height = rotated ? w : hgt;
          }
        } else if (t === "trak" || t === "mdia") {
          walk(body);
        }
        p += s;
      }
    };
    walk(moov);
  } catch {
    // file hong/khong phai mp4: bo qua, nen tang se tu bao loi
  } finally {
    await fh.close();
  }
  return info;
}
