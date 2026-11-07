import { backWithErrors, redirectWith, type Input } from "@/lib/http";
import { exists, validate, type Rules } from "@/lib/validator";
import { authorizeHandler } from "@/server/auth";
import type { FormRoute } from "@/server/routes";
import { phpClean } from "@/modules/slide/php";
import { createFeature, destroyFeature, NHOM, updateFeature } from "./home-feature";

/** routes/web/home_feature.route.php — HomeFeatureController store/update/destroy */

// StoreHomeFeatureRequest (dung cho ca store va update)
const rules: Rules = {
  group: ["required", `in:${Object.keys(NHOM).join(",")}`],
  title: ["required", "string", "max:191"],
  description: ["nullable", "string", "max:191"],
  value: ["nullable", "string", "max:50"],
  icon: ["nullable", "string", "max:191"],
  post_id: ["nullable", "integer", exists("posts", "id")],
  order: "nullable|integer|min:0",
};
const messages = {
  "group.required": "Bạn chưa chọn khối hiển thị.",
  "group.in": "Khối hiển thị không hợp lệ.",
  "title.required": "Bạn chưa nhập tiêu đề.",
  "title.max": "Tiêu đề tối đa 191 ký tự.",
  "description.max": "Mô tả tối đa 191 ký tự.",
  "value.max": "Con số tối đa 50 ký tự.",
  "icon.max": "Đường dẫn icon tối đa 191 ký tự.",
  "post_id.exists": "Bài viết được chọn không còn tồn tại.",
  "order.integer": "Thứ tự phải là số nguyên.",
};

const INDEX = "/home-feature/index";

export const routes: FormRoute[] = [
  {
    method: "POST",
    path: "home-feature/store",
    handler: async ({ req, input }) => {
      const admin = await authorizeHandler(req);
      if (admin instanceof Response) return admin;
      const errors = await validate(phpClean(input) as Input, rules, messages);
      if (errors) return backWithErrors(req, errors, input);
      try {
        await createFeature(input);
      } catch (e) {
        console.error("Them noi dung trang chu that bai:", e);
        return redirectWith(req, INDEX, { error: "Thêm mới bản ghi không thành công. Hãy thử lại" });
      }
      return redirectWith(req, INDEX, { success: "Thêm mới bản ghi thành công" });
    },
  },
  {
    method: "POST",
    path: "home-feature/{id:\\d+}/update",
    handler: async ({ req, params, input }) => {
      const admin = await authorizeHandler(req);
      if (admin instanceof Response) return admin;
      const errors = await validate(phpClean(input) as Input, rules, messages);
      if (errors) return backWithErrors(req, errors, input);
      try {
        await updateFeature(BigInt(params.id), input);
      } catch (e) {
        console.error("Cap nhat noi dung trang chu that bai:", e);
        return redirectWith(req, INDEX, { error: "Cập nhật bản ghi không thành công. Hãy thử lại" });
      }
      return redirectWith(req, INDEX, { success: "Cập nhật bản ghi thành công" });
    },
  },
  {
    method: "DELETE",
    path: "home-feature/{id:\\d+}/destroy",
    handler: async ({ req, params }) => {
      const admin = await authorizeHandler(req);
      if (admin instanceof Response) return admin;
      try {
        await destroyFeature(BigInt(params.id));
      } catch (e) {
        console.error("Xoa noi dung trang chu that bai:", e);
        return redirectWith(req, INDEX, { error: "Xóa bản ghi không thành công. Hãy thử lại" });
      }
      return redirectWith(req, INDEX, { success: "Xóa bản ghi thành công" });
    },
  },
];
