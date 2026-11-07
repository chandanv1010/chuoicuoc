import { readFile } from "node:fs/promises";
import { designFilePath, getDesignRequest } from "@/modules/design/requests";
import { authorizeHandler } from "@/server/auth";

const TYPES: Record<string, string> = { png: "image/png", jpg: "image/jpeg", webp: "image/webp" };

/** GET /design-request/<id>/file/<name> — anh trong thiet ke khach gui (chi admin). ?download=1 de tai ve. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string; name: string }> }) {
  const admin = await authorizeHandler(req, "order.index");
  if (admin instanceof Response) return admin;
  const { id, name } = await params;
  const request = await getDesignRequest(id);
  const file = request && designFilePath(request, name);
  if (!file) return new Response("Not Found", { status: 404 });
  const buf = await readFile(file).catch(() => null);
  if (!buf) return new Response("Not Found", { status: 404 });
  const download = new URL(req.url).searchParams.has("download");
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": TYPES[name.split(".").pop() ?? ""] ?? "application/octet-stream",
      "Cache-Control": "private, no-store",
      ...(download ? { "Content-Disposition": `attachment; filename="${request.code}-${name}"` } : {}),
    },
  });
}
