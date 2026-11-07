import "server-only";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

const TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".bmp": "image/bmp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".pdf": "application/pdf",
  ".txt": "text/plain; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".zip": "application/zip",
};

/** Tra file tinh tu thu muc storage (Next khong phuc vu file them vao public/ sau khi build). */
export async function serveFile(req: Request, root: string, segments: string[]) {
  const rel = segments.map((s) => decodeURIComponent(s)).join("/");
  const abs = path.resolve(root, rel);
  if (!abs.startsWith(path.resolve(root) + path.sep)) return new Response("Not Found", { status: 404 });
  const info = await stat(abs).catch(() => null);
  if (!info?.isFile()) return new Response("Not Found", { status: 404 });

  const type = TYPES[path.extname(abs).toLowerCase()] ?? "application/octet-stream";
  const headers: Record<string, string> = {
    "content-type": type,
    "cache-control": "public, max-age=2592000",
    "last-modified": info.mtime.toUTCString(),
    "accept-ranges": "bytes",
    // Khong cho trinh duyet chay noi dung upload nhu trang web
    "x-content-type-options": "nosniff",
  };
  if (req.headers.get("if-modified-since") === headers["last-modified"]) return new Response(null, { status: 304, headers });

  const range = req.headers.get("range")?.match(/^bytes=(\d*)-(\d*)$/);
  if (range) {
    const start = range[1] ? Number(range[1]) : Math.max(0, info.size - Number(range[2]));
    const end = range[1] && range[2] ? Math.min(Number(range[2]), info.size - 1) : info.size - 1;
    if (start >= info.size || start > end) return new Response(null, { status: 416, headers: { "content-range": `bytes */${info.size}` } });
    const stream = Readable.toWeb(createReadStream(abs, { start, end })) as ReadableStream;
    return new Response(stream, {
      status: 206,
      headers: { ...headers, "content-range": `bytes ${start}-${end}/${info.size}`, "content-length": String(end - start + 1) },
    });
  }
  const stream = Readable.toWeb(createReadStream(abs)) as ReadableStream;
  return new Response(stream, { headers: { ...headers, "content-length": String(info.size) } });
}
