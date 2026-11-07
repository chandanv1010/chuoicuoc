import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { coasterColor, THREAD_COLORS } from "./config";
import { DESIGN_DIR, type DesignRequest } from "./requests";

/**
 * File may theu cho xuong (DST/PES/EXP/JEF + bang mau chi) tu thiet ke khach gui.
 * Dich vu theu (emhaus-stitch-spike, STITCH_SERVICE_URL) ghep cac hinh/chu dung vi tri, kich thuoc, goc xoay
 * (placed-*.png), digitize bang Ink/Stitch va ghi vao storage/design/<id>/machine/.
 */

const SERVICE = process.env.STITCH_SERVICE_URL || "http://127.0.0.1:8790";

export const MACHINE_FORMATS = [
  { key: "dst", label: "DST", note: "Tajima — đa số máy công nghiệp" },
  { key: "pes", label: "PES", note: "Brother / Babylock" },
  { key: "exp", label: "EXP", note: "Melco / Bernina" },
  { key: "jef", label: "JEF", note: "Janome" },
] as const;

export type MachineStop = { stop: number; code: string; name: string; hex: string };
export type MachineReport = {
  stitches: number;
  colors: number;
  trims: number;
  width_mm: number;
  height_mm: number;
  est_minutes: number;
  threads: { code: string; name: string; hex: string }[];
  stops: MachineStop[];
  files: string[];
  thin_warnings: { thread: string; thin_share: number }[];
  low_contrast: string[];
  placement?: {
    width_mm: number;
    height_mm: number;
    offset_mm: [number, number];
    coaster_mm: [number, number];
    items: { id: string; kind: string; text: string | null; size_mm: [number, number]; rotation: number; center_mm: [number, number] }[];
  };
  generated_at?: string;
  max_colors?: number;
};

/** Ten file duoc phep tai trong thu muc machine/. */
const MACHINE_FILE_RE = /^(design\.(dst|pes|exp|jef|svg)|composite\.png|preview\.png|on-fabric\.png|sheet\.jpg|threads\.txt)$/;

export function machineFilePath(req: DesignRequest, name: string): string | null {
  return MACHINE_FILE_RE.test(name) ? path.join(DESIGN_DIR, req.id, "machine", name) : null;
}

export async function machineReport(req: DesignRequest): Promise<MachineReport | null> {
  try {
    return JSON.parse(await readFile(path.join(DESIGN_DIR, req.id, "machine", "report.json"), "utf8")) as MachineReport;
  } catch {
    return null;
  }
}

/** Goi dich vu theu tao file may. Tra ve bao cao, hoac loi de hien cho admin. */
export async function digitizeRequest(req: DesignRequest, opts: { maxColors: number; formats: string[] }): Promise<{ ok: true; report: MachineReport } | { ok: false; error: string }> {
  if (req.spec.product !== "napkin") return { ok: false, error: "Hiện mới hỗ trợ tạo file máy cho lót cốc." };
  const fabric = coasterColor(req.spec.material, req.spec.color)?.hex;
  const border = req.spec.border && req.spec.border !== "none" ? THREAD_COLORS.find((c) => c.key === req.spec.borderColor)?.hex : undefined;
  let res: Response;
  try {
    res = await fetch(`${SERVICE}/digitize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ job: req.id, fabric_hex: fabric, border_hex: border, max_colors: opts.maxColors, formats: opts.formats }),
      signal: AbortSignal.timeout(10 * 60_000),
      cache: "no-store",
    });
  } catch (e) {
    return { ok: false, error: `Không gọi được dịch vụ thêu (${SERVICE}): ${(e as Error).message}. Kiểm tra container emhaus-stitch.` };
  }
  const body = (await res.json().catch(() => ({}))) as MachineReport & { error?: string };
  if (!res.ok) return { ok: false, error: body.error ?? `Dịch vụ thêu lỗi ${res.status}` };
  return { ok: true, report: body };
}
