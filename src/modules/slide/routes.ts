import { backWithErrors, redirectWith } from "@/lib/http";
import { getCurrentLanguage } from "@/lib/language";
import { unique, validate } from "@/lib/validator";
import { authorizeHandler } from "@/server/auth";
import type { FormRoute } from "@/server/routes";
import { phpClean } from "./php";
import { createSlide, destroySlide, updateSlide } from "./slide";

/** routes/web/slide.route.php — SlideController store/update/destroy */
const messages = {
  "name.required": "Bạn chưa nhập tên của Slide",
  "keyword.required": "Bạn chưa nhập từ khóa của slide",
  "slide.image.required": "Bạn chưa chọn hình ảnh nào cho slide",
};

export const routes: FormRoute[] = [
  {
    method: "POST",
    path: "slide/store",
    handler: async ({ req, input }) => {
      const admin = await authorizeHandler(req);
      if (admin instanceof Response) return admin;
      // StoreSlideRequest
      const errors = await validate(
        phpClean(input) as typeof input,
        { name: "required", keyword: ["required", unique("slides", "keyword")], "slide.image": "required" },
        messages,
      );
      if (errors) return backWithErrors(req, errors, input);
      const language = await getCurrentLanguage();
      try {
        await createSlide(input, language.id);
      } catch (e) {
        // Laravel: echo $e->getMessage(); die();
        console.error(e);
        return redirectWith(req, "/slide/index", { error: "Thêm mới bản ghi không thành công. Hãy thử lại" });
      }
      return redirectWith(req, "/slide/index", { success: "Thêm mới bản ghi thành công" });
    },
  },
  {
    method: "POST",
    path: "slide/{id:\\d+}/update",
    handler: async ({ req, params, input }) => {
      const admin = await authorizeHandler(req);
      if (admin instanceof Response) return admin;
      // UpdateSlideRequest: unique:slides,keyword,{id}
      const errors = await validate(
        phpClean(input) as typeof input,
        { name: "required", keyword: ["required", unique("slides", "keyword", { ignore: params.id })], "slide.image": "required" },
        messages,
      );
      if (errors) return backWithErrors(req, errors, input);
      const language = await getCurrentLanguage();
      try {
        await updateSlide(BigInt(params.id), input, language.id);
      } catch (e) {
        console.error(e);
        return redirectWith(req, "/slide/index", { error: "Cập nhật bản ghi không thành công. Hãy thử lại" });
      }
      return redirectWith(req, "/slide/index", { success: "Cập nhật bản ghi thành công" });
    },
  },
  {
    method: "DELETE",
    path: "slide/{id:\\d+}/destroy",
    handler: async ({ req, params }) => {
      const admin = await authorizeHandler(req);
      if (admin instanceof Response) return admin;
      try {
        await destroySlide(BigInt(params.id));
      } catch (e) {
        console.error(e);
        return redirectWith(req, "/slide/index", { error: "Xóa bản ghi không thành công. Hãy thử lại" });
      }
      return redirectWith(req, "/slide/index", { success: "Xóa bản ghi thành công" });
    },
  },
];
