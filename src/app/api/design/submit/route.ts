import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { cookies } from "next/headers";
import { SHAPE_PRESETS } from "@/components/site/design/shapes";
import {
  CAP_COLORS,
  CAP_ZONES,
  COASTER_BACKINGS,
  COASTER_MATERIALS,
  COASTER_SIZE,
  DESIGN_LIMITS,
  HAT_DESIGN_ENABLED,
  SITE_DESIGN_ENABLED,
  NAPKIN_BORDERS,
  THREAD_COLORS,
  TSHIRT_COLORS,
  TSHIRT_ZONES,
  type DesignItem,
  type DesignSpec,
} from "@/modules/design/config";
import { STORAGE_DIR } from "@/server/media";

/**
 * POST /api/design/submit (multipart) — khach gui thiet ke ve xuong.
 * Luu storage/design/<id>/: request.json (thong tin khach + spec), original-<item>.<ext> (anh goc),
 * placed-<item>.png (anh/chu da dat), view-<goc>.png (anh chup mo hinh 3D). Xuong xem o admin /design-request/index.
 */
export const runtime = "nodejs";

const DESIGN_DIR = path.join(STORAGE_DIR, "design");
const recent = new Map<string, number[]>();
const fail = (status: number, error: string) => Response.json({ error }, { status });

function sniff(buf: Buffer): "png" | "jpg" | "webp" | null {
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") return "webp";
  return null;
}

const num = (v: unknown, min: number, max: number) => typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
const vec = (v: unknown) => Array.isArray(v) && v.length === 3 && v.every((x) => num(x, -1000, 1000));

/** Kiem tra spec tu client (khong tin client): chi giu truong da biet, gioi han gia tri. */
function cleanSpec(raw: unknown): DesignSpec | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Record<string, unknown>;
  const product = (s.product === "hat" && HAT_DESIGN_ENABLED) || s.product === "napkin" || s.product === "tshirt" ? (s.product as "hat" | "napkin" | "tshirt") : null;
  if (!product) return null;
  // lot coc: mau phai thuoc chat lieu da chon
  const material = product === "napkin" ? COASTER_MATERIALS.find((m) => m.key === (s.material ?? "linen")) : undefined;
  if (product === "napkin" && !material) return null;
  const colors = product === "hat" ? CAP_COLORS : product === "tshirt" ? TSHIRT_COLORS : material!.colors;
  if (!colors.some((c) => c.key === s.color)) return null;
  const backing = product === "napkin" ? (COASTER_BACKINGS.find((b) => b.key === s.backing)?.key ?? "none") : undefined;
  const border = product === "napkin" ? NAPKIN_BORDERS.find((b) => b.key === s.border)?.key : undefined;
  if (product === "napkin" && !border) return null;
  // lot coc: hinh dang, kich thuoc, duong cat (mm)
  let coaster: Partial<DesignSpec> = {};
  if (product === "napkin") {
    const shape = typeof s.shape === "string" && (s.shape === "image" || s.shape === "custom" || SHAPE_PRESETS.some((p) => p.key === s.shape)) ? s.shape : null;
    const outline = Array.isArray(s.outline) && s.outline.length >= 3 && s.outline.length <= 4000 && s.outline.every((p) => Array.isArray(p) && p.length === 2 && num(p[0], -200, 200) && num(p[1], -200, 200));
    if (!shape || !num(s.sizeMm, COASTER_SIZE.min, COASTER_SIZE.max) || !outline) return null;
    const borderColor = border !== "none" ? THREAD_COLORS.find((c) => c.key === s.borderColor)?.key : undefined;
    coaster = {
      material: material!.key,
      backing,
      shape,
      sizeMm: s.sizeMm as number,
      outline: s.outline as [number, number][],
      ...(borderColor ? { borderColor } : {}),
      ...(shape === "image" ? { shapeMarginMm: num(s.shapeMarginMm, 0, 20) ? (s.shapeMarginMm as number) : 0, shapeSmoothMm: num(s.shapeSmoothMm, 0, 40) ? (s.shapeSmoothMm as number) : 0, shapeImageOnCoaster: s.shapeImageOnCoaster === true, shapeKeepBg: s.shapeKeepBg === true } : {}),
    };
  }
  // lot coc cat theo anh va theu chinh anh do: khong can them hinh/chu nao khac
  const minItems = coaster.shape === "image" && coaster.shapeImageOnCoaster ? 0 : 1;
  if (!Array.isArray(s.items) || s.items.length < minItems || s.items.length > DESIGN_LIMITS.maxItems) return null;
  const zones = product === "hat" ? CAP_ZONES.map((z) => z.key) : product === "tshirt" ? TSHIRT_ZONES.map((z) => z.key) : ["center"];
  const items: DesignItem[] = [];
  for (const r of s.items as Record<string, unknown>[]) {
    if (typeof r.id !== "string" || !/^[a-z0-9]{4,12}$/.test(r.id)) return null;
    if (r.kind !== "image" && r.kind !== "text") return null;
    if (typeof r.zone !== "string" || !zones.includes(r.zone)) return null;
    if (!num(r.widthMm, 1, 200) || !num(r.heightMm, 1, 300) || !num(r.rotationDeg, -180, 180) || !vec(r.point) || !vec(r.normal)) return null;
    items.push({
      id: r.id,
      kind: r.kind,
      zone: r.zone,
      widthMm: r.widthMm as number,
      heightMm: r.heightMm as number,
      rotationDeg: r.rotationDeg as number,
      point: r.point as [number, number, number],
      normal: r.normal as [number, number, number],
      ...(r.kind === "text" ? { text: String(r.text ?? "").slice(0, 60), font: String(r.font ?? "").slice(0, 20), thread: String(r.thread ?? "").slice(0, 20) } : {}),
      ...(typeof r.fileName === "string" ? { fileName: r.fileName.slice(0, 120) } : {}),
      ...(r.kind === "image" ? { removeBg: r.removeBg === true } : {}),
      ...(r.kind === "image" && Array.isArray(r.crop) && r.crop.length === 4 && r.crop.every((x) => num(x, 0, 1))
        ? { crop: r.crop as [number, number, number, number] }
        : {}),
    });
  }
  return { product, color: s.color as string, border, ...coaster, items };
}

async function imagePart(form: FormData, key: string, maxBytes: number) {
  const f = form.get(key);
  if (!(f instanceof File) || f.size === 0) return null;
  if (f.size > maxBytes) throw new Error("too large");
  const buf = Buffer.from(await f.arrayBuffer());
  const ext = sniff(buf);
  if (!ext) throw new Error("bad image");
  return { buf, ext };
}

export async function POST(request: Request) {
  if (!SITE_DESIGN_ENABLED) return new Response("Not found", { status: 404 });
  const sid = (await cookies()).get("nc_sid")?.value ?? "anon";
  const t = Date.now();
  const times = (recent.get(sid) ?? []).filter((x) => t - x < 3_600_000);
  if (times.length >= 10) return fail(429, "Too many designs sent this hour. Please try again later.");

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail(400, "Invalid request.");
  }
  const name = String(form.get("name") ?? "").trim().slice(0, 120);
  const email = String(form.get("email") ?? "").trim().slice(0, 190);
  const quantity = Math.round(Number(form.get("quantity") ?? 1));
  const notes = String(form.get("notes") ?? "").trim().slice(0, 1000);
  if (!name) return fail(400, "Enter your name.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail(400, "Enter a valid email.");
  if (!(quantity >= 1 && quantity <= 500)) return fail(400, "Quantity must be 1–500.");

  let spec: DesignSpec | null = null;
  try {
    spec = cleanSpec(JSON.parse(String(form.get("spec") ?? "")));
  } catch {
    spec = null;
  }
  if (!spec) return fail(400, "The design data is incomplete. Please reload the page and try again.");

  const id = randomBytes(10).toString("hex");
  const dir = path.join(DESIGN_DIR, id);
  try {
    const files: Record<string, string> = {};
    const writes: [string, Buffer][] = [];
    for (const it of spec.items) {
      const placed = await imagePart(form, `placed-${it.id}`, DESIGN_LIMITS.maxUploadBytes);
      if (!placed) return fail(400, "A design image is missing. Please try again.");
      writes.push([`placed-${it.id}.${placed.ext}`, placed.buf]);
      files[`placed-${it.id}`] = `placed-${it.id}.${placed.ext}`;
      const original = it.kind === "image" ? await imagePart(form, `original-${it.id}`, DESIGN_LIMITS.maxUploadBytes) : null;
      if (original) {
        writes.push([`original-${it.id}.${original.ext}`, original.buf]);
        files[`original-${it.id}`] = `original-${it.id}.${original.ext}`;
      }
    }
    if (spec.shape === "image") {
      // anh khach dung lam dang lot coc: anh goc + anh da bo nen
      for (const k of ["shape-original", "shape-placed"]) {
        const img = await imagePart(form, k, DESIGN_LIMITS.maxUploadBytes);
        if (img) {
          writes.push([`${k}.${img.ext}`, img.buf]);
          files[k] = `${k}.${img.ext}`;
        }
      }
      if (!files["shape-placed"]) return fail(400, "The coaster shape image is missing. Please try again.");
    }
    const views: string[] = [];
    for (const v of ["front", "left", "right", "back", "napkin"]) {
      const img = await imagePart(form, `view-${v}`, 4 * 1024 * 1024);
      if (img) {
        writes.push([`view-${v}.${img.ext}`, img.buf]);
        views.push(`view-${v}.${img.ext}`);
      }
    }
    await mkdir(dir, { recursive: true });
    for (const [file, buf] of writes) await writeFile(path.join(dir, file), buf);
    const code = id.slice(0, 8).toUpperCase();
    await writeFile(
      path.join(dir, "request.json"),
      JSON.stringify({ id, code, status: "new", created_at: new Date(t).toISOString(), customer: { name, email, quantity, notes }, spec, files, views }, null, 2),
    );
    recent.set(sid, [...times, t]);
    return Response.json({ code });
  } catch (e) {
    if (e instanceof Error && (e.message === "too large" || e.message === "bad image")) return fail(400, "One of the images could not be read. Use PNG, JPG or WEBP under 8 MB.");
    console.error("[design] submit failed", e);
    return fail(500, "Could not save your design. Please try again.");
  }
}
