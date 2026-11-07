import path from "node:path";
import { STORAGE_DIR } from "@/server/media";
import { serveFile } from "@/server/static-file";

/** GET /uploads/... — file upload nam trong storage/uploads (public/uploads cua Laravel). */
export async function GET(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  return serveFile(req, path.join(STORAGE_DIR, "uploads"), (await params).path);
}
