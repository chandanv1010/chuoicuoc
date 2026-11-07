import { readFile } from "node:fs/promises";
import { machineFilePath } from "@/modules/design/machine";
import { getDesignRequest } from "@/modules/design/requests";
import { authorizeHandler } from "@/server/auth";

const TYPES: Record<string, string> = { png: "image/png", jpg: "image/jpeg", svg: "image/svg+xml", txt: "text/plain; charset=utf-8" };

/** GET /design-request/<id>/machine/<name> — file may theu / anh xem truoc (chi admin). File may luon tai ve. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string; name: string }> }) {
  const admin = await authorizeHandler(req, "order.index");
  if (admin instanceof Response) return admin;
  const { id, name } = await params;
  const request = await getDesignRequest(id);
  const file = request && machineFilePath(request, name);
  if (!file) return new Response("Not Found", { status: 404 });
  const buf = await readFile(file).catch(() => null);
  if (!buf) return new Response("Not Found", { status: 404 });
  const ext = name.split(".").pop() ?? "";
  const download = !TYPES[ext] || ext === "svg" || new URL(req.url).searchParams.has("download");
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": TYPES[ext] ?? "application/octet-stream",
      "Cache-Control": "private, no-store",
      ...(download ? { "Content-Disposition": `attachment; filename="${request.code}-${name}"` } : {}),
    },
  });
}
