import { redirectWith } from "@/lib/http";
import { getCurrentLanguage } from "@/lib/language";
import { authorizeHandler } from "@/server/auth";
import type { FormRoute } from "@/server/routes";
import { saveKeywordTable } from "./service";

/** routes/web/core.route.php (prefix system) — SystemController@store / @saveTranslate */
export const routes: FormRoute[] = [
  {
    method: "POST",
    path: "system/store",
    handler: async ({ req, input }) => {
      const admin = await authorizeHandler(req);
      if (admin instanceof Response) return admin;
      const language = await getCurrentLanguage();
      try {
        await saveKeywordTable("systems", input, language.id, admin.id);
      } catch (e) {
        console.error(e);
        return redirectWith(req, "/system/index", { error: "Cập nhật bản ghi không thành công. Hãy thử lại" });
      }
      return redirectWith(req, "/system/index", { success: "Cập nhật bản ghi thành công" });
    },
  },
  {
    method: "POST",
    path: "system/{languageId:\\d+}/saveTranslate",
    handler: async ({ req, params, input }) => {
      const admin = await authorizeHandler(req);
      if (admin instanceof Response) return admin;
      try {
        await saveKeywordTable("systems", input, BigInt(params.languageId), admin.id);
      } catch (e) {
        console.error(e);
        return redirectWith(req, "/system/index", { error: "Cập nhật bản ghi không thành công. Hãy thử lại" });
      }
      return redirectWith(req, `/system/${params.languageId}/translate`, { success: "Cập nhật bản ghi thành công" });
    },
  },
];
