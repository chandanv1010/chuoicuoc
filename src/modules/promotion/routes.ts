import { flash } from "@/lib/flash";
import { back, backWithErrors, redirectWith } from "@/lib/http";
import { authorizeHandler } from "@/server/auth";
import type { FormRoute } from "@/server/routes";
import { createPromotion, destroyPromotion, updatePromotion } from "./promotion";
import { validatePromotion } from "./promotion-request";

/**
 * routes/web/promotion.route.php — PromotionController store/update/destroy.
 * Service goc loi thi `echo $e->getMessage(); die();` -> o day flash error va quay lai.
 */
async function failed(req: Request, e: unknown, message: string) {
  console.error(e);
  await flash({ error: message });
  return back(req, "/promotion/index");
}

export const routes: FormRoute[] = [
  {
    method: "POST",
    path: "promotion/store",
    handler: async ({ req, input }) => {
      const admin = await authorizeHandler(req);
      if (admin instanceof Response) return admin;
      const errors = await validatePromotion(input, null); // StorePromotionRequest
      if (errors) return backWithErrors(req, errors, input);
      try {
        await createPromotion(input);
      } catch (e) {
        return failed(req, e, "Thêm mới bản ghi không thành công. Hãy thử lại");
      }
      return redirectWith(req, "/promotion/index", { success: "Thêm mới bản ghi thành công" });
    },
  },
  {
    method: "POST",
    path: "promotion/{id:\\d+}/update",
    handler: async ({ req, params, input }) => {
      const admin = await authorizeHandler(req);
      if (admin instanceof Response) return admin;
      const errors = await validatePromotion(input, params.id); // UpdatePromotionRequest
      if (errors) return backWithErrors(req, errors, input);
      try {
        await updatePromotion(BigInt(params.id), input);
      } catch (e) {
        return failed(req, e, "Cập nhật bản ghi không thành công. Hãy thử lại");
      }
      return redirectWith(req, "/promotion/index", { success: "Cập nhật bản ghi thành công" });
    },
  },
  {
    method: "DELETE",
    path: "promotion/{id:\\d+}/destroy",
    handler: async ({ req, params }) => {
      const admin = await authorizeHandler(req);
      if (admin instanceof Response) return admin;
      try {
        await destroyPromotion(BigInt(params.id));
      } catch (e) {
        console.error(e);
        return redirectWith(req, "/promotion/index", { error: "Xóa bản ghi không thành công. Hãy thử lại" });
      }
      return redirectWith(req, "/promotion/index", { success: "Xóa bản ghi thành công" });
    },
  },
];
