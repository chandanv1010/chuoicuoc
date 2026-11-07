import { redirectWith } from "@/lib/http";
import { authorizeHandler } from "@/server/auth";
import type { FormRoute } from "@/server/routes";
import { destroyReview } from "./review";

/** routes/web/core.route.php — ReviewController@destroy */
export const routes: FormRoute[] = [
  {
    method: "DELETE",
    path: "review/{id:\\d+}/destroy",
    handler: async ({ req, params }) => {
      const admin = await authorizeHandler(req);
      if (admin instanceof Response) return admin;
      try {
        await destroyReview(BigInt(params.id));
      } catch (e) {
        console.error(e);
        return redirectWith(req, "/review/index", { error: "Xóa bản ghi không thành công. Hãy thử lại" });
      }
      return redirectWith(req, "/review/index", { success: "Xóa bản ghi thành công" });
    },
  },
];
