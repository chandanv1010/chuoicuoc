import { backWithErrors, redirectWith } from "@/lib/http";
import { getCurrentLanguage } from "@/lib/language";
import { validate } from "@/lib/validator";
import { db } from "@/lib/db";
import { authorizeHandler } from "@/server/auth";
import type { FormRoute } from "@/server/routes";
import { phpClean } from "@/modules/slide/php";
import { destroyMenuCatalogue, saveChildren, saveMenu, saveTranslateMenu } from "./menu";

/**
 * routes/web/menu.route.php — MenuController store/saveChildren/destroy/saveTranslate.
 * Route POST menu/{id}/update co khai bao nhung controller khong co action update
 * (Laravel tra 500) nen khong port.
 */
export const routes: FormRoute[] = [
  {
    method: "POST",
    path: "menu/store",
    handler: async ({ req, input }) => {
      const admin = await authorizeHandler(req);
      if (admin instanceof Response) return admin;
      // StoreMenuRequest
      const errors = await validate(
        phpClean(input) as typeof input,
        { menu_catalogue_id: "gt:0", "menu.name": "required" },
        { "menu_catalogue_id.gt": "Bạn chưa chọn vị trí hiển thị của Menu", "menu.name.required": "Bạn phải tạo ít nhất 1 menu" },
      );
      if (errors) return backWithErrors(req, errors, input);
      const language = await getCurrentLanguage();
      try {
        await saveMenu(input, language.id, admin.id);
      } catch (e) {
        // Laravel: echo $e->getMessage(); die();
        console.error(e);
        return redirectWith(req, "/menu/index", { error: "Cập nhật bản ghi không thành công. Hãy thử lại" });
      }
      const catalogueId = String(phpClean(input.menu_catalogue_id) ?? "");
      return redirectWith(req, `/menu/${catalogueId}/edit`, { success: "Cập nhật bản ghi thành công" });
    },
  },
  {
    method: "POST",
    path: "menu/{id:\\d+}/saveChildren",
    handler: async ({ req, params, input }) => {
      const admin = await authorizeHandler(req);
      if (admin instanceof Response) return admin;
      // StoreMenuChildrenRequest
      const errors = await validate(phpClean(input) as typeof input, { "menu.name": "required" }, { "menu.name.required": "Bạn phải tạo ít nhất 1 menu" });
      if (errors) return backWithErrors(req, errors, input);
      const menu = await db.menus.findFirst({ where: { id: BigInt(params.id), deleted_at: null } });
      if (!menu) return new Response("404 | Not Found", { status: 404 });
      const language = await getCurrentLanguage();
      const target = `/menu/${menu.menu_catalogue_id}/edit`;
      try {
        await saveChildren(input, language.id, menu, admin.id);
      } catch (e) {
        console.error(e);
        return redirectWith(req, target, { error: "Thêm mới bản ghi không thành công. Hãy thử lại" });
      }
      return redirectWith(req, target, { success: "Thêm mới bản ghi thành công" });
    },
  },
  {
    method: "DELETE",
    path: "menu/{id:\\d+}/destroy",
    handler: async ({ req, params }) => {
      const admin = await authorizeHandler(req);
      if (admin instanceof Response) return admin;
      try {
        await destroyMenuCatalogue(BigInt(params.id));
      } catch (e) {
        console.error(e);
        return redirectWith(req, "/menu/index", { error: "Xóa bản ghi không thành công. Hãy thử lại" });
      }
      return redirectWith(req, "/menu/index", { success: "Xóa bản ghi thành công" });
    },
  },
  {
    method: "POST",
    path: "menu/{languageId:\\d+}/saveTranslate",
    handler: async ({ req, params, input }) => {
      const admin = await authorizeHandler(req);
      if (admin instanceof Response) return admin;
      try {
        await saveTranslateMenu(input, BigInt(params.languageId));
      } catch (e) {
        console.error(e);
        return redirectWith(req, "/menu/index", { error: "Cập nhật bản ghi không thành công. Hãy thử lại" });
      }
      return redirectWith(req, "/menu/index", { success: "Cập nhật bản ghi thành công" });
    },
  },
];
