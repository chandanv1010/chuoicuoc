import { backWithErrors, redirectWith, type Input } from "@/lib/http";
import { getCurrentLanguage } from "@/lib/language";
import { unique, validate } from "@/lib/validator";
import { authorizeHandler } from "@/server/auth";
import type { FormContext, FormRoute } from "@/server/routes";
import { laravelInput } from "@/modules/product/payload";
import { decodedQueryOf, withRawQuery } from "@/modules/product/query-string";
import { createAttribute, destroyAttribute, updateAttribute } from "./attribute";
import {
  createAttributeCatalogue,
  destroyAttributeCatalogue,
  isAttributeCatalogueLeaf,
  updateAttributeCatalogue,
} from "./attribute-catalogue";

/**
 * Form POST/PUT/DELETE cua module attribute (routes/web/product.route.php, group
 * ['admin','locale','backend_default_locale']): AttributeCatalogueController + AttributeController.
 * Ban goc: them/sua/xoa thanh cong hay that bai deu ve trang index (khong co send_and_stay).
 */

const messages = {
  "name.required": "Bạn chưa nhập vào ô tiêu đề.",
  "canonical.required": "Bạn chưa nhập vào ô đường dẫn",
  "canonical.unique": "Đường dẫn đã tồn tại, Hãy chọn đường dẫn khác",
};

function handle(fn: (ctx: FormContext & { adminId: bigint }) => Promise<Response>) {
  return async (ctx: FormContext) => {
    const admin = await authorizeHandler(ctx.req);
    if (admin instanceof Response) return admin;
    return fn({ ...ctx, input: laravelInput<Input>(ctx.input), adminId: admin.id });
  };
}

const uniqueCanonical = (id?: string) => unique("routers", "canonical", id ? { ignore: id, ignoreColumn: "module_id" } : {});

export const routes: FormRoute[] = [
  // ---- AttributeCatalogueController ----
  {
    method: "POST",
    path: "attribute/catalogue/store",
    handler: handle(async ({ req, input, adminId }) => {
      const errors = await validate(input, { name: "required", canonical: ["required", uniqueCanonical()] }, messages);
      if (errors) return backWithErrors(req, errors, input);
      const language = await getCurrentLanguage();
      try {
        await createAttributeCatalogue(input, language.id, adminId);
      } catch (e) {
        console.error(e); // ban goc: echo $e->getMessage(); die();
        return redirectWith(req, "/attribute/catalogue/index", { error: "Thêm mới bản ghi không thành công. Hãy thử lại" });
      }
      return redirectWith(req, "/attribute/catalogue/index", { success: "Thêm mới bản ghi thành công" });
    }),
  },
  {
    method: "POST",
    path: "attribute/catalogue/{id:\\d+}/update",
    handler: handle(async ({ req, params, input }) => {
      const errors = await validate(input, { name: "required", canonical: ["required", uniqueCanonical(params.id)] }, messages);
      if (errors) return backWithErrors(req, errors, input);
      const queryUrl = decodedQueryOf(req);
      const language = await getCurrentLanguage();
      try {
        await updateAttributeCatalogue(BigInt(params.id), input, language.id);
      } catch (e) {
        console.error(e);
        return redirectWith(req, "/attribute/catalogue/index", { error: "Cập nhật bản ghi không thành công. Hãy thử lại" });
      }
      return redirectWith(req, withRawQuery("/attribute/catalogue/index", queryUrl), { success: "Cập nhật bản ghi thành công" });
    }),
  },
  {
    method: "DELETE",
    path: "attribute/catalogue/{id:\\d+}/destroy",
    handler: handle(async ({ req, params, input }) => {
      const id = BigInt(params.id);
      // DeleteAttributeCatalogueRequest: CheckAttributeCatalogueChildrenRule tren truong name
      if (input.name !== undefined && input.name !== null && !(await isAttributeCatalogueLeaf(id))) {
        return backWithErrors(req, { name: ["Không thể xóa do vẫn còn danh mục con"] }, input);
      }
      const language = await getCurrentLanguage();
      try {
        await destroyAttributeCatalogue(id, language.id);
      } catch (e) {
        console.error(e);
        return redirectWith(req, "/attribute/catalogue/index", { error: "Xóa bản ghi không thành công. Hãy thử lại" });
      }
      return redirectWith(req, "/attribute/catalogue/index", { success: "Xóa bản ghi thành công" });
    }),
  },

  // ---- AttributeController ----
  {
    method: "POST",
    path: "attribute/store",
    handler: handle(async ({ req, input, adminId }) => {
      const errors = await validate(input, { name: "required", canonical: ["required", uniqueCanonical()] }, messages);
      if (errors) return backWithErrors(req, errors, input);
      const language = await getCurrentLanguage();
      try {
        await createAttribute(input, language.id, adminId);
      } catch (e) {
        console.error(e);
        return redirectWith(req, "/attribute/index", { error: "Thêm mới bản ghi không thành công. Hãy thử lại" });
      }
      return redirectWith(req, "/attribute/index", { success: "Thêm mới bản ghi thành công" });
    }),
  },
  {
    method: "POST",
    path: "attribute/{id:\\d+}/update",
    handler: handle(async ({ req, params, input }) => {
      const errors = await validate(input, { name: "required", canonical: ["required", uniqueCanonical(params.id)] }, messages);
      if (errors) return backWithErrors(req, errors, input);
      const queryUrl = decodedQueryOf(req);
      const language = await getCurrentLanguage();
      try {
        await updateAttribute(BigInt(params.id), input, language.id);
      } catch (e) {
        console.error(e);
        return redirectWith(req, "/attribute/index", { error: "Cập nhật bản ghi không thành công. Hãy thử lại" });
      }
      return redirectWith(req, withRawQuery("/attribute/index", queryUrl), { success: "Cập nhật bản ghi thành công" });
    }),
  },
  {
    method: "DELETE",
    path: "attribute/{id:\\d+}/destroy",
    handler: handle(async ({ req, params }) => {
      try {
        await destroyAttribute(BigInt(params.id));
      } catch (e) {
        console.error(e);
        return redirectWith(req, "/attribute/index", { error: "Xóa bản ghi không thành công. Hãy thử lại" });
      }
      return redirectWith(req, "/attribute/index", { success: "Xóa bản ghi thành công" });
    }),
  },
];
