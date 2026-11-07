import { redirectWith } from "@/lib/http";
import { getCurrentLanguage } from "@/lib/language";
import { authorizeHandler } from "@/server/auth";
import type { FormRoute } from "@/server/routes";
import { saveKeywordTable } from "@/modules/system/service";

/**
 * routes/web/core.route.php (prefix introduce) — IntroduceController@store / @saveTranslate.
 * Cac route introduce/{id}/update, introduce/{id}/destroy tro toi method khong ton tai
 * trong IntroduceController (Laravel loi 500) nen khong port.
 */
export const routes: FormRoute[] = [
  {
    method: "POST",
    path: "introduce/store",
    handler: async ({ req, input }) => {
      const admin = await authorizeHandler(req);
      if (admin instanceof Response) return admin;
      const language = await getCurrentLanguage();
      try {
        await saveKeywordTable("introduces", input, language.id, admin.id);
      } catch (e) {
        console.error(e);
        return redirectWith(req, "/introduce/index", { error: "Cập nhật bản ghi không thành công. Hãy thử lại" });
      }
      return redirectWith(req, "/introduce/index", { success: "Cập nhật bản ghi thành công" });
    },
  },
  {
    method: "POST",
    path: "introduce/{languageId:\\d+}/saveTranslate",
    handler: async ({ req, params, input }) => {
      const admin = await authorizeHandler(req);
      if (admin instanceof Response) return admin;
      try {
        await saveKeywordTable("introduces", input, BigInt(params.languageId), admin.id);
      } catch (e) {
        console.error(e);
        return redirectWith(req, "/introduce/index", { error: "Cập nhật bản ghi không thành công. Hãy thử lại" });
      }
      return redirectWith(req, `/introduce/${params.languageId}/translate`, { success: "Cập nhật bản ghi thành công" });
    },
  },
];
