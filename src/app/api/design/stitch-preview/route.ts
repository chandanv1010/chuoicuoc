import { randomBytes } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { cookies } from "next/headers";
import { SITE_DESIGN_ENABLED } from "@/modules/design/config";
import { STORAGE_DIR } from "@/server/media";

/**
 * POST /api/design/stitch-preview (multipart: image PNG, width_mm, max_colors)
 * -> PNG nen trong suot ve tu MUI THEU THAT: dich vu theu (sanbox/emhaus-stitch-spike, Ink/Stitch) digitize anh
 *    roi ve lai tung mui. Header X-Stitch-Report: so mui, so mau chi, kich thuoc, thoi gian may.
 * Chi de khach xem truoc tren trang Design; file may theu that do xuong lam khi nhan don.
 */
export const runtime = "nodejs";
export const maxDuration = 120;

const SERVICE = process.env.STITCH_SERVICE_URL || "http://127.0.0.1:8790";
// dich vu doc/ghi trong storage/design (mount /data); thu muc tam ten 24 ky tu nen khong lan voi don thiet ke (20 ky tu)
const DESIGN_DIR = path.join(STORAGE_DIR, "design");
const recent = new Map<string, number[]>();
// thu tu mui (stitches.json) cua cac lan xem truoc gan day, cho trinh "Watch it stitch" tai khi can (GET ?token=)
const runs = new Map<string, { at: number; json: string }>();
const RUNS_TTL = 60 * 60_000;
const keepRuns = (json: string) => {
  const t = Date.now();
  for (const [k, v] of runs) if (t - v.at > RUNS_TTL || runs.size > 300) runs.delete(k);
  const token = randomBytes(12).toString("hex");
  runs.set(token, { at: t, json });
  return token;
};

export async function GET(request: Request) {
  if (!SITE_DESIGN_ENABLED) return new Response("Not found", { status: 404 });
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const hit = runs.get(token);
  if (!hit) return fail(404, "This stitch preview has expired. Switch to Original and back to Stitched preview.");
  return new Response(hit.json, { headers: { "Content-Type": "application/json", "Cache-Control": "private, max-age=3600" } });
}
const fail = (status: number, error: string) => Response.json({ error }, { status });

export async function POST(request: Request) {
  if (!SITE_DESIGN_ENABLED) return new Response("Not found", { status: 404 });
  const sid = (await cookies()).get("nc_sid")?.value ?? "anon";
  const t = Date.now();
  const times = (recent.get(sid) ?? []).filter((x) => t - x < 3_600_000);
  if (times.length >= 60) return fail(429, "Too many stitch previews this hour. Please try again later.");

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail(400, "Invalid request.");
  }
  const file = form.get("image");
  const width = Math.round(Number(form.get("width_mm")) * 10) / 10;
  const colors = Math.round(Number(form.get("max_colors") ?? 6));
  if (!(file instanceof File) || file.size === 0 || file.size > 8 * 1024 * 1024) return fail(400, "Upload a PNG image under 8 MB.");
  if (!(width >= 10 && width <= 130)) return fail(400, "Width must be 10–130 mm for a stitch preview.");
  if (!(colors >= 1 && colors <= 8)) return fail(400, "Thread colors must be 1–8.");
  const buf = Buffer.from(await file.arrayBuffer());
  if (!buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return fail(415, "Send a PNG image.");

  const job = randomBytes(12).toString("hex");
  const dir = path.join(DESIGN_DIR, job);
  recent.set(sid, [...times, t]);
  try {
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "input.png"), buf);
    // anh tu trang Design da bo nen (alpha) -> giu nguyen mang trang ben trong hinh
    const res = await fetch(`${SERVICE}/stitch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ job, width_mm: width, max_colors: colors, keep_inner_white: true }),
      signal: AbortSignal.timeout(110_000),
    });
    const report = await res.json().catch(() => ({}));
    if (!res.ok) return fail(res.status === 422 ? 422 : 502, res.status === 422 && report.error ? report.error : "Could not create the stitch preview. Please try again.");
    const png = await readFile(path.join(dir, "preview.png"));
    const stitchRuns = await readFile(path.join(dir, "stitches.json"), "utf8").catch(() => null);
    const summary = { stitches: report.stitches, colors: report.colors, width_mm: report.width_mm, height_mm: report.height_mm, est_minutes: report.est_minutes, threads: report.threads };
    return new Response(new Uint8Array(png), {
      headers: { "Content-Type": "image/png", "Cache-Control": "no-store", "X-Stitch-Report": encodeURIComponent(JSON.stringify(summary)), ...(stitchRuns ? { "X-Stitch-Token": keepRuns(stitchRuns) } : {}) },
    });
  } catch (e) {
    console.error("[design] stitch preview failed", e);
    return fail(503, "The stitch preview service is not available right now.");
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
