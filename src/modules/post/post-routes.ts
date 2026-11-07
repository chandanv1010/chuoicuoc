import { flash } from "@/lib/flash";
import { back, backWithErrors, redirectWith, str } from "@/lib/http";
import { getCurrentLanguage } from "@/lib/language";
import { unique, validate } from "@/lib/validator";
import { authorizeHandler } from "@/server/auth";
import type { FormRoute } from "@/server/routes";
import { enqueueSocialAfterSave } from "@/modules/social/enqueue";
import { createPost, destroyPost, updatePost } from "./post";

const messages = {
  "name.required": "Bạn chưa nhập vào ô tiêu đề.",
  "canonical.required": "Bạn chưa nhập vào ô đường dẫn",
  "canonical.unique": "Đường dẫn đã tồn tại, Hãy chọn đường dẫn khác",
  "post_catalogue_id.gt": "Bạn phải nhập vào danh mục cha",
};

/** PostController store/update/destroy */
export const postRoutes: FormRoute[] = [
  {
    method: "POST",
    path: "post/store",
    handler: async ({ req, input }) => {
      const admin = await authorizeHandler(req);
      if (admin instanceof Response) return admin;
      const errors = await validate(
        input,
        { name: "required", canonical: ["required", unique("routers", "canonical")], post_catalogue_id: "gt:0" },
        messages,
      );
      if (errors) return backWithErrors(req, errors, input);
      const language = await getCurrentLanguage();
      let created: { id: bigint };
      try {
        created = await createPost(input, language.id, admin.id);
      } catch (e) {
        console.error(e);
        await flash({ error: "Thêm mới bản ghi không thành công. Hãy thử lại" });
        return back(req);
      }
      // Dang mang xa hoi (khoi social_publish): khong nem loi, khong doi hanh vi luu
      await enqueueSocialAfterSave(input, "Post", created.id, admin.id);
      if (str(input, "send") === "send_and_stay") {
        await flash({ success: "Thêm mới bản ghi thành công" });
        return back(req);
      }
      return redirectWith(req, "/post/index", { success: "Thêm mới bản ghi thành công" });
    },
  },
  {
    method: "POST",
    path: "post/{id:\\d+}/update",
    handler: async ({ req, params, input }) => {
      const admin = await authorizeHandler(req);
      if (admin instanceof Response) return admin;
      const errors = await validate(
        input,
        {
          name: "required",
          canonical: ["required", unique("routers", "canonical", { ignore: params.id, ignoreColumn: "module_id" })],
          post_catalogue_id: "gt:0",
        },
        messages,
      );
      if (errors) return backWithErrors(req, errors, input);
      const language = await getCurrentLanguage();
      try {
        await updatePost(BigInt(params.id), input, language.id);
      } catch (e) {
        console.error(e);
        await flash({ error: "Cập nhật bản ghi không thành công. Hãy thử lại" });
        return back(req);
      }
      await enqueueSocialAfterSave(input, "Post", params.id, admin.id);
      if (str(input, "send") === "send_and_stay") {
        return redirectWith(req, `/post/${params.id}/edit?query=`, { success: "Cập nhật bản ghi thành công" });
      }
      return redirectWith(req, "/post/index", { success: "Cập nhật bản ghi thành công" });
    },
  },
  {
    method: "DELETE",
    path: "post/{id:\\d+}/destroy",
    handler: async ({ req, params }) => {
      const admin = await authorizeHandler(req);
      if (admin instanceof Response) return admin;
      try {
        await destroyPost(BigInt(params.id));
      } catch (e) {
        console.error(e);
        return redirectWith(req, "/post/index", { error: "Xóa bản ghi không thành công. Hãy thử lại" });
      }
      return redirectWith(req, "/post/index", { success: "Xóa bản ghi thành công" });
    },
  },
];
