import { flash } from "@/lib/flash";
import { logoutGuard } from "@/lib/session";
import { absoluteUrl } from "@/lib/origin";

/** GET /logout — AuthController@logout */
export async function GET(req: Request) {
  await logoutGuard("admin");
  await flash({});
  return Response.redirect(absoluteUrl(req, "/admin"), 302);
}
