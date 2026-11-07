import "server-only";
import { mkdir, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Kho file thay cho CKFinder 2 (public/userfiles cua Laravel).
 * File nam o STORAGE_DIR/userfiles/<image|file|flash>/..., phuc vu qua /userfiles/...
 * Cau hinh loai tai nguyen chep tu backend/plugins/ckfinder_2/config.php.
 */
export const STORAGE_DIR = path.resolve(process.env.STORAGE_DIR || path.join(/*turbopackIgnore: true*/ process.cwd(), "storage"));
export const USERFILES_DIR = path.join(STORAGE_DIR, "userfiles");

export const RESOURCE_TYPES = {
  Files: {
    dir: "file",
    maxSize: 1024 * 1024 * 1024,
    allowed:
      "7z,aiff,asf,avi,bmp,csv,doc,docx,fla,flv,gif,gz,gzip,jpeg,jpg,mid,mov,mp3,mp4,mpc,mpeg,mpg,ods,odt,pdf,png,ppt,pptx,pxd,qt,ram,rar,rm,rmi,rmvb,rtf,sdc,sitd,swf,sxc,sxw,tar,tgz,tif,tiff,txt,vsd,wav,wma,wmv,xls,xlsx,zip",
  },
  Images: { dir: "image", maxSize: 1024 * 1024 * 1024, allowed: "bmp,gif,jpeg,jpg,png,webp,mp4" },
  Flash: { dir: "flash", maxSize: 1024 * 1024 * 1024, allowed: "swf,flv,mp4,avi" },
} as const;

export type ResourceType = keyof typeof RESOURCE_TYPES;

export function resourceType(value: string | null): ResourceType {
  return value && value in RESOURCE_TYPES ? (value as ResourceType) : "Images";
}

export class MediaError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

/** Duong dan thu muc con an toan ("/a/b/") -> duong dan tuyet doi trong kho. */
export function resolveFolder(type: ResourceType, folder: string | null) {
  const root = path.join(USERFILES_DIR, RESOURCE_TYPES[type].dir);
  const clean = (folder ?? "/").replaceAll("\\", "/");
  const abs = path.resolve(root, `.${clean.startsWith("/") ? clean : `/${clean}`}`);
  if (abs !== root && !abs.startsWith(root + path.sep)) throw new MediaError("Đường dẫn không hợp lệ", 403);
  return { root, abs, rel: path.relative(root, abs).replaceAll(path.sep, "/") };
}

export function urlFor(type: ResourceType, rel: string, name?: string) {
  const parts = [RESOURCE_TYPES[type].dir, ...rel.split("/").filter(Boolean), ...(name ? [name] : [])];
  return `/userfiles/${parts.map(encodeURIComponent).join("/")}`;
}

/** Ten file/thu muc: bo ky tu nguy hiem, giu tieng Viet. */
export function safeName(name: string) {
  const cleaned = name
    .normalize("NFC")
    .replace(/[\\/:*?"<>|\x00-\x1f]/g, "_")
    .replace(/^\.+/, "")
    .trim();
  if (!cleaned || cleaned === "." || cleaned === "..") throw new MediaError("Tên không hợp lệ");
  return cleaned;
}

function checkExtension(type: ResourceType, name: string) {
  const ext = path.extname(name).slice(1).toLowerCase();
  const allowed = RESOURCE_TYPES[type].allowed.split(",").map((s) => s.trim());
  if (!ext || !allowed.includes(ext)) throw new MediaError(`Định dạng .${ext || "?"} không được phép`);
  // CheckDoubleExtension: chan foo.php.jpg
  const inner = name.split(".").slice(1, -1).map((s) => s.toLowerCase());
  if (inner.some((s) => ["php", "phtml", "js", "html", "htm", "exe", "sh", "svg"].includes(s))) {
    throw new MediaError("Tên file không hợp lệ");
  }
}

export async function listFolders(type: ResourceType, folder: string) {
  const { abs } = resolveFolder(type, folder);
  await mkdir(abs, { recursive: true });
  const entries = await readdir(abs, { withFileTypes: true });
  const out = [];
  for (const e of entries.filter((e) => e.isDirectory() && !e.name.startsWith("."))) {
    const sub = await readdir(path.join(abs, e.name), { withFileTypes: true }).catch(() => []);
    out.push({ name: e.name, hasChildren: sub.some((s) => s.isDirectory()) });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, "vi"));
}

export async function listFiles(type: ResourceType, folder: string) {
  const { abs, rel } = resolveFolder(type, folder);
  await mkdir(abs, { recursive: true });
  const entries = await readdir(abs, { withFileTypes: true });
  const files = [];
  for (const e of entries.filter((e) => e.isFile() && !e.name.startsWith("."))) {
    const s = await stat(path.join(abs, e.name));
    files.push({ name: e.name, size: s.size, date: s.mtime.toISOString(), url: urlFor(type, rel, e.name) });
  }
  return files.sort((a, b) => b.date.localeCompare(a.date));
}

/** Upload: trung ten thi them (1), (2)... giong CKFinder. */
export async function saveUpload(type: ResourceType, folder: string, file: File) {
  const { abs, rel } = resolveFolder(type, folder);
  let name = safeName(file.name);
  checkExtension(type, name);
  if (file.size > RESOURCE_TYPES[type].maxSize) throw new MediaError("File quá lớn");
  await mkdir(abs, { recursive: true });
  const ext = path.extname(name);
  const base = name.slice(0, name.length - ext.length);
  for (let i = 1; await exists(path.join(abs, name)); i++) name = `${base}(${i})${ext}`;
  await writeFile(path.join(abs, name), Buffer.from(await file.arrayBuffer()));
  return { name, url: urlFor(type, rel, name) };
}

export async function createFolder(type: ResourceType, folder: string, name: string) {
  const { abs } = resolveFolder(type, folder);
  const target = path.join(abs, safeName(name));
  if (await exists(target)) throw new MediaError("Thư mục đã tồn tại");
  await mkdir(target, { recursive: true });
}

export async function deleteFiles(type: ResourceType, folder: string, names: string[]) {
  const { abs } = resolveFolder(type, folder);
  for (const n of names) await rm(path.join(abs, safeName(n)), { force: true });
}

export async function renameEntry(type: ResourceType, folder: string, from: string, to: string, isFolder: boolean) {
  const { abs } = resolveFolder(type, folder);
  const target = safeName(to);
  if (!isFolder) checkExtension(type, target);
  const dest = path.join(abs, target);
  if (await exists(dest)) throw new MediaError("Tên đã tồn tại");
  await rename(path.join(abs, safeName(from)), dest);
}

export async function deleteFolder(type: ResourceType, folder: string) {
  const { abs, root } = resolveFolder(type, folder);
  if (abs === root) throw new MediaError("Không thể xóa thư mục gốc");
  await rm(abs, { recursive: true, force: true });
}

async function exists(p: string) {
  return stat(p).then(
    () => true,
    () => false,
  );
}
