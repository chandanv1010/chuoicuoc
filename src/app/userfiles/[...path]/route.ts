import path from "node:path";
import { STORAGE_DIR } from "@/server/media";
import { serveFile } from "@/server/static-file";

/** GET /userfiles/... — file upload nam trong storage/userfiles (public/userfiles cua Laravel). */
export async function GET(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  return serveFile(req, path.join(STORAGE_DIR, "userfiles"), (await params).path);
}
