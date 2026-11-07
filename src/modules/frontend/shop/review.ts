import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { now } from "@/lib/helpers";
import type { Input } from "@/lib/http";
import { STORAGE_DIR } from "@/server/media";
import { PhpException, num } from "./php";

/**
 * ReviewService::create + App\Classes\ReviewNested (POST ajax/review/create).
 * Anh danh gia luu storage/userfiles/image (public/userfiles/image cua Laravel).
 */

/** uniqid(): 13 ky tu hex theo thoi gian */
function uniqid() {
  const ms = Date.now();
  return Math.floor(ms / 1000).toString(16) + ((ms % 1000) * 1000 + Math.floor(Math.random() * 1000)).toString(16).padStart(5, "0");
}

/** ReviewNested: Get() -> Set() -> Recursive(0) -> Action() cho mot reviewable_type. */
async function rebuild(tx: Prisma.TransactionClient, reviewableType: string) {
  const rows = await tx.$queryRaw<{ id: bigint; parent_id: number }[]>`
    SELECT id, parent_id FROM reviews WHERE reviewable_type = ${reviewableType} ORDER BY lft ASC`;
  const arr = new Map<number, Map<number, 1>>();
  const put = (a: number, b: number) => {
    let m = arr.get(a);
    if (!m) arr.set(a, (m = new Map()));
    m.set(b, 1);
  };
  for (const r of rows) {
    put(Number(r.id), Number(r.parent_id));
    put(Number(r.parent_id), Number(r.id));
  }
  const lft = new Map<number, number>();
  const rgt = new Map<number, number>();
  const level = new Map<number, number>();
  const checked = new Set<string>();
  let count = 0;
  let countLevel = 0;
  const recursive = (start: number) => {
    lft.set(start, ++count);
    level.set(start, countLevel);
    for (const key of arr.keys()) {
      const linked = arr.get(start)?.has(key) || arr.get(key)?.has(start);
      if (linked && !checked.has(`${key}:${start}`) && !checked.has(`${start}:${key}`)) {
        countLevel++;
        checked.add(`${start}:${key}`);
        checked.add(`${key}:${start}`);
        recursive(key);
        countLevel--;
      }
    }
    rgt.set(start, ++count);
  };
  recursive(0);
  for (const [id, lv] of level) {
    if (id === 0) continue;
    await tx.$executeRaw`UPDATE reviews SET level = ${lv}, lft = ${lft.get(id)!}, rgt = ${rgt.get(id)!} WHERE id = ${id}`;
  }
}

export async function createReview(payload: Input) {
  const data = { ...payload };
  delete data._token;
  const image = data.image;
  delete data.image;
  let imagePath: string | null = null;
  let buf: Buffer | null = null;
  if (image instanceof File && image.size > 0) {
    if (!["image/png", "image/jpeg", "image/webp"].includes(image.type)) throw new PhpException("File type not allowed. Use PNG, JPEG or WebP.");
    if (image.size > 5 * 1024 * 1024) throw new PhpException("The image is too large. Please choose a file under 5 MB.");
    const ext = path.extname(image.name).replace(/^\./, "");
    const name = `${Math.floor(Date.now() / 1000)}_${uniqid()}.${ext}`;
    buf = Buffer.from(await image.arrayBuffer());
    imagePath = `userfiles/image/${name}`;
  } else if (typeof image === "string") imagePath = image;

  const s = (k: string) => (data[k] === undefined || data[k] === null || data[k] instanceof File ? "" : String(data[k]));
  const ts = now();
  await db.$transaction(async (tx) => {
    // Review::$fillable; cot NOT NULL thieu -> '' / 0 nhu MySQL non-strict cua Laravel
    await tx.$executeRaw`
      INSERT INTO reviews (reviewable_type, reviewable_id, email, gender, fullname, phone, description, score, status, image, created_at, updated_at)
      VALUES (${s("reviewable_type")}, ${Math.trunc(num(data.reviewable_id))}, ${s("email")}, ${s("gender").slice(0, 10)}, ${s("fullname")},
        ${s("phone").slice(0, 12)}, ${s("description").slice(0, 191)}, ${Math.trunc(num(data.score))}, ${Math.trunc(num(data.status))}, ${imagePath}, ${ts}, ${ts})`;
    if (data.reviewable_type === undefined) throw new PhpException('Undefined array key "reviewable_type"');
    await rebuild(tx, s("reviewable_type"));
  });
  if (buf && imagePath) {
    await mkdir(path.join(STORAGE_DIR, "userfiles", "image"), { recursive: true });
    await writeFile(path.join(STORAGE_DIR, imagePath), buf);
  }
  return { code: 10, message: "Thanks for your review!" };
}
