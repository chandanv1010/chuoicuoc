import { getCurrentLanguage } from "@/lib/language";
import { back, backWithErrors, redirectWith, str } from "@/lib/http";
import { flash } from "@/lib/flash";
import { unique, validate } from "@/lib/validator";
import { authorizeHandler } from "@/server/auth";
import type { FormRoute } from "@/server/routes";
import { createPostCatalogue, destroyPostCatalogue, isLeaf, updatePostCatalogue } from "./post-catalogue";
import { postRoutes } from "./post-routes";

/** routes/web/post.route.php — group middleware ['admin','locale','backend_default_locale'] */
const catalogueMessages = {
  "name.required": "Bạn chưa nhập vào ô tiêu đề.",
  "canonical.required": "Bạn chưa nhập vào ô đường dẫn",
  "canonical.unique": "Đường dẫn đã tồn tại, Hãy chọn đường dẫn khác",
};

export const routes: FormRoute[] = [
  {
    method: "POST",
    path: "post/catalogue/store",
    handler: async ({ req, input }) => {
      const admin = await authorizeHandler(req);
      if (admin instanceof Response) return admin;
      // StorePostCatalogueRequest
      const errors = await validate(input, { name: "required", canonical: ["required", unique("routers", "canonical")] }, catalogueMessages);
      if (errors) return backWithErrors(req, errors, input);
      const language = await getCurrentLanguage();
      try {
        await createPostCatalogue(input, language.id, admin.id);
      } catch (e) {
        console.error(e);
        await flash({ error: "Thêm mới bản ghi không thành công. Hãy thử lại" });
        return back(req);
      }
      if (str(input, "send") === "send_and_stay") {
        await flash({ success: "Thêm mới bản ghi thành công" });
        return back(req);
      }
      return redirectWith(req, "/post/catalogue/index", { success: "Thêm mới bản ghi thành công" });
    },
  },
  {
    method: "POST",
    path: "post/catalogue/{id:\\d+}/update",
    handler: async ({ req, params, input }) => {
      const admin = await authorizeHandler(req);
      if (admin instanceof Response) return admin;
      // UpdatePostCatalogueRequest: unique:routers,canonical,{id},module_id
      const errors = await validate(
        input,
        { name: "required", canonical: ["required", unique("routers", "canonical", { ignore: params.id, ignoreColumn: "module_id" })] },
        catalogueMessages,
      );
      if (errors) return backWithErrors(req, errors, input);
      const language = await getCurrentLanguage();
      try {
        await updatePostCatalogue(BigInt(params.id), input, language.id);
      } catch (e) {
        console.error(e);
        await flash({ error: "Cập nhật bản ghi không thành công. Hãy thử lại" });
        return back(req);
      }
      if (str(input, "send") === "send_and_stay") {
        return redirectWith(req, `/post/catalogue/${params.id}/edit?query=`, { success: "Cập nhật bản ghi thành công" });
      }
      return redirectWith(req, "/post/catalogue/index", { success: "Cập nhật bản ghi thành công" });
    },
  },
  {
    method: "DELETE",
    path: "post/catalogue/{id:\\d+}/destroy",
    handler: async ({ req, params, input }) => {
      const admin = await authorizeHandler(req);
      if (admin instanceof Response) return admin;
      const id = BigInt(params.id);
      // DeletePostCatalogueRequest: CheckPostCatalogueChildrenRule
      if (!(await isLeaf(id))) {
        return backWithErrors(req, { name: ["Không thể xóa do vẫn còn danh mục con"] }, input);
      }
      const language = await getCurrentLanguage();
      try {
        await destroyPostCatalogue(id, language.id);
      } catch (e) {
        console.error(e);
        return redirectWith(req, "/post/catalogue/index", { error: "Xóa bản ghi không thành công. Hãy thử lại" });
      }
      return redirectWith(req, "/post/catalogue/index", { success: "Xóa bản ghi thành công" });
    },
  },
  ...postRoutes,
];
