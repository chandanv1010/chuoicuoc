import { flash } from "@/lib/flash";
import { back, backWithErrors, redirectWith, str, type Input } from "@/lib/http";
import { getCurrentLanguage } from "@/lib/language";
import { unique, validate } from "@/lib/validator";
import { authorizeHandler } from "@/server/auth";
import type { FormContext, FormRoute } from "@/server/routes";
import { enqueueSocialAfterSave } from "@/modules/social/enqueue";
import { laravelInput } from "./payload";
import { createProduct, destroyProduct, updateProduct } from "./product";
import { createProductCatalogue, destroyProductCatalogue, isProductCatalogueLeaf, updateProductCatalogue } from "./product-catalogue";
import { decodedQueryOf, stayQuery, withRawQuery } from "./query-string";

/**
 * Form POST/PUT/DELETE cua module product (routes/web/product.route.php, group
 * ['admin','locale','backend_default_locale']): ProductCatalogueController + ProductController.
 */

const catalogueMessages = {
  "name.required": "Bạn chưa nhập vào ô tiêu đề.",
  "canonical.required": "Bạn chưa nhập vào ô đường dẫn",
  "canonical.unique": "Đường dẫn đã tồn tại, Hãy chọn đường dẫn khác",
};

const productMessages = {
  ...catalogueMessages,
  "product_catalogue_id.gt": "Bạn phải nhập vào danh mục cha",
  "stock.integer": "Tồn kho phải là số nguyên.",
  "stock.min": "Tồn kho không được âm.",
};

/** Bo boc chung: dang nhap + TrimStrings/ConvertEmptyStringsToNull. */
function handle(fn: (ctx: FormContext & { adminId: bigint }) => Promise<Response>) {
  return async (ctx: FormContext) => {
    const admin = await authorizeHandler(ctx.req);
    if (admin instanceof Response) return admin;
    return fn({ ...ctx, input: laravelInput<Input>(ctx.input), adminId: admin.id });
  };
}

/** unique:routers,canonical, {id},module_id (ban goc co khoang trang truoc id, Laravel tu trim) */
const uniqueCanonical = (id?: string) => unique("routers", "canonical", id ? { ignore: id, ignoreColumn: "module_id" } : {});

export const routes: FormRoute[] = [
  // ---- ProductCatalogueController ----
  {
    method: "POST",
    path: "product/catalogue/store",
    handler: handle(async ({ req, input, adminId }) => {
      // StoreProductCatalogueRequest
      const errors = await validate(input, { name: "required", canonical: ["required", uniqueCanonical()] }, catalogueMessages);
      if (errors) return backWithErrors(req, errors, input);
      const language = await getCurrentLanguage();
      try {
        await createProductCatalogue(input, language.id, adminId);
      } catch (e) {
        // ban goc: echo $e->getMessage(); die();
        console.error(e);
        await flash({ error: "Thêm mới bản ghi không thành công. Hãy thử lại" });
        return back(req);
      }
      if (str(input, "send") === "send_and_stay") {
        await flash({ success: "Thêm mới bản ghi thành công" });
        return back(req);
      }
      return redirectWith(req, "/product/catalogue/index", { success: "Thêm mới bản ghi thành công" });
    }),
  },
  {
    method: "POST",
    path: "product/catalogue/{id:\\d+}/update",
    handler: handle(async ({ req, params, input }) => {
      // UpdateProductCatalogueRequest
      const errors = await validate(input, { name: "required", canonical: ["required", uniqueCanonical(params.id)] }, catalogueMessages);
      if (errors) return backWithErrors(req, errors, input);
      const queryString = decodedQueryOf(req);
      const language = await getCurrentLanguage();
      try {
        await updateProductCatalogue(BigInt(params.id), input, language.id);
      } catch (e) {
        console.error(e);
        await flash({ error: "Cập nhật bản ghi không thành công. Hãy thử lại" });
        return back(req);
      }
      if (str(input, "send") === "send_and_stay") {
        return redirectWith(req, `/product/catalogue/${params.id}/edit?${stayQuery(queryString)}`, { success: "Cập nhật bản ghi thành công" });
      }
      return redirectWith(req, withRawQuery("/product/catalogue/index", queryString), { success: "Cập nhật bản ghi thành công" });
    }),
  },
  {
    method: "DELETE",
    path: "product/catalogue/{id:\\d+}/destroy",
    handler: handle(async ({ req, params, input }) => {
      const id = BigInt(params.id);
      // DeleteProductCatalogueRequest: CheckProductCatalogueChildrenRule tren truong name
      if (input.name !== undefined && input.name !== null && !(await isProductCatalogueLeaf(id))) {
        return backWithErrors(req, { name: ["Không thể xóa do vẫn còn danh mục con"] }, input);
      }
      const language = await getCurrentLanguage();
      try {
        await destroyProductCatalogue(id, language.id);
      } catch (e) {
        console.error(e);
        return redirectWith(req, "/product/catalogue/index", { error: "Xóa bản ghi không thành công. Hãy thử lại" });
      }
      return redirectWith(req, "/product/catalogue/index", { success: "Xóa bản ghi thành công" });
    }),
  },

  // ---- ProductController ----
  {
    method: "POST",
    path: "product/store",
    handler: handle(async ({ req, input, adminId }) => {
      // StoreProductRequest
      const errors = await validate(
        input,
        { name: "required", canonical: ["required", uniqueCanonical()], product_catalogue_id: "gt:0", stock: "nullable|integer|min:0" },
        productMessages,
      );
      if (errors) return backWithErrors(req, errors, input);
      const language = await getCurrentLanguage();
      let created: { id: bigint };
      try {
        created = await createProduct(input, language.id, adminId);
      } catch (e) {
        console.error(e);
        await flash({ error: "Thêm mới bản ghi không thành công. Hãy thử lại" });
        return back(req);
      }
      // Dang mang xa hoi (khoi social_publish): khong nem loi, khong doi hanh vi luu
      await enqueueSocialAfterSave(input, "Product", created.id, adminId);
      if (str(input, "send") === "send_and_stay") {
        await flash({ success: "Thêm mới bản ghi thành công" });
        return back(req);
      }
      return redirectWith(req, "/product/index", { success: "Thêm mới bản ghi thành công" });
    }),
  },
  {
    method: "POST",
    path: "product/{id:\\d+}/update",
    handler: handle(async ({ req, params, input, adminId }) => {
      // UpdateProductRequest
      const errors = await validate(
        input,
        { name: "required", canonical: ["required", uniqueCanonical(params.id)], product_catalogue_id: "gt:0", stock: "nullable|integer|min:0" },
        productMessages,
      );
      if (errors) return backWithErrors(req, errors, input);
      const queryString = decodedQueryOf(req);
      const language = await getCurrentLanguage();
      try {
        await updateProduct(BigInt(params.id), input, language.id, adminId);
      } catch (e) {
        console.error(e);
        await flash({ error: "Cập nhật bản ghi không thành công. Hãy thử lại" });
        return back(req);
      }
      await enqueueSocialAfterSave(input, "Product", params.id, adminId);
      if (str(input, "send") === "send_and_stay") {
        return redirectWith(req, `/product/${params.id}/edit?${stayQuery(queryString)}`, { success: "Cập nhật bản ghi thành công" });
      }
      return redirectWith(req, withRawQuery("/product/index", queryString), { success: "Cập nhật bản ghi thành công" });
    }),
  },
  {
    method: "DELETE",
    path: "product/{id:\\d+}/destroy",
    handler: handle(async ({ req, params }) => {
      try {
        await destroyProduct(BigInt(params.id));
      } catch (e) {
        console.error(e);
        return redirectWith(req, "/product/index", { error: "Xóa bản ghi không thành công. Hãy thử lại" });
      }
      return redirectWith(req, "/product/index", { success: "Xóa bản ghi thành công" });
    }),
  },
];
