import { requestOrigin } from "@/lib/origin";
import { dispatch } from "@/server/routes";

/** Diem vao cua moi form POST/PUT/DELETE (proxy.ts chuyen toi day). */
type Ctx = { params: Promise<{ path: string[] }> };

async function handle(req: Request, { params }: Ctx) {
  const origin = req.headers.get("origin");
  // Thay cho CSRF token cua Laravel: chi nhan form gui tu chinh site nay (ke ca khi qua proxy/tunnel).
  if (origin && origin !== new URL(req.url).origin && origin !== requestOrigin(req)) {
    return new Response("419 | Page Expired", { status: 419 });
  }
  const { path } = await params;
  return dispatch(req, path.map(decodeURIComponent).join("/"));
}

export { handle as POST, handle as PUT, handle as PATCH, handle as DELETE };
