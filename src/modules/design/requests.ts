import "server-only";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { DESIGN_ID_RE, type DesignSpec } from "./config";
import { STORAGE_DIR } from "@/server/media";

/** Thiet ke khach gui tu trang /design (luu file trong storage/design/<id>/request.json). */
export type DesignRequest = {
  id: string;
  code: string;
  status: string;
  created_at: string;
  customer: { name: string; email: string; quantity: number; notes: string };
  spec: DesignSpec;
  files: Record<string, string>;
  views: string[];
};

export const DESIGN_DIR = path.join(STORAGE_DIR, "design");

export async function getDesignRequest(id: string): Promise<DesignRequest | null> {
  if (!DESIGN_ID_RE.test(id)) return null;
  try {
    return JSON.parse(await readFile(path.join(DESIGN_DIR, id, "request.json"), "utf8")) as DesignRequest;
  } catch {
    return null;
  }
}

export async function listDesignRequests(): Promise<DesignRequest[]> {
  let dirs: string[] = [];
  try {
    dirs = (await readdir(DESIGN_DIR)).filter((d) => DESIGN_ID_RE.test(d));
  } catch {
    return [];
  }
  const rows = await Promise.all(dirs.map(getDesignRequest));
  return rows.filter((r): r is DesignRequest => r !== null).sort((a, b) => b.created_at.localeCompare(a.created_at));
}

/** Duong dan file trong mot yeu cau, chi cho phep ten file da ghi trong request.json. */
export function designFilePath(req: DesignRequest, name: string): string | null {
  const allowed = new Set([...Object.values(req.files), ...req.views]);
  return allowed.has(name) ? path.join(DESIGN_DIR, req.id, name) : null;
}
