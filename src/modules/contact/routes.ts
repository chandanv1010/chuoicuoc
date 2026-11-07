import { redirectWith } from "@/lib/http";
import { authorizeHandler } from "@/server/auth";
import type { FormRoute } from "@/server/routes";
import { destroyContact } from "./contact";

/** routes/web/core.route.php — Backend ContactController@destroy */
export const routes: FormRoute[] = [
  {
    method: "DELETE",
    path: "contact/{id:\\d+}/destroy",
    handler: async ({ req, params }) => {
      const admin = await authorizeHandler(req);
      if (admin instanceof Response) return admin;
      try {
        await destroyContact(BigInt(params.id));
      } catch (e) {
        console.error(e);
        return redirectWith(req, "/contact/index", { error: "Xóa bản ghi không thành công. Hãy thử lại" });
      }
      return redirectWith(req, "/contact/index", { success: "Xóa bản ghi thành công" });
    },
  },
];
