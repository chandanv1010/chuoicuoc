import { backWithErrors, redirectWith } from "@/lib/http";
import { getCurrentLanguage } from "@/lib/language";
import { unique, validate } from "@/lib/validator";
import { authorizeHandler } from "@/server/auth";
import type { FormRoute } from "@/server/routes";
import { laravelInput } from "@/modules/dashboard/ui";
import { createWidget, destroyWidget, saveWidgetTranslate, updateWidget } from "./service";

/** routes/web/core.route.php (prefix widget) — WidgetController store/update/destroy/saveTranslate */

const messages = {
  "name.required": "Bạn chưa nhập tên của Widget",
  "keyword.required": "Bạn chưa nhập từ khóa của Widget",
  "keyword.unique": "Từ khóa đã tồn tại, hãy chọn từ khóa khác",
  "short_code.unique": "Shortcode đã tồn tại, hãy chọn tên shortcode khác",
};

async function attempt(req: Request, fn: () => Promise<unknown>, ok: string, fail: string) {
  try {
    await fn();
  } catch (e) {
    console.error(e);
    return redirectWith(req, "/widget/index", { error: fail });
  }
  return redirectWith(req, "/widget/index", { success: ok });
}

export const routes: FormRoute[] = [
  {
    method: "POST",
    path: "widget/store",
    handler: async ({ req, input: raw }) => {
      const admin = await authorizeHandler(req);
      if (admin instanceof Response) return admin;
      const input = laravelInput(raw);
      const errors = await validate(
        input,
        { name: "required", keyword: ["required", unique("widgets", "keyword")], short_code: ["required", unique("widgets", "short_code")] },
        messages,
      );
      if (errors) return backWithErrors(req, errors, input);
      const language = await getCurrentLanguage();
      return attempt(req, () => createWidget(input, language.id), "Thêm mới bản ghi thành công", "Thêm mới bản ghi không thành công. Hãy thử lại");
    },
  },
  {
    method: "POST",
    path: "widget/{id:\\d+}/update",
    handler: async ({ req, params, input: raw }) => {
      const admin = await authorizeHandler(req);
      if (admin instanceof Response) return admin;
      const input = laravelInput(raw);
      const errors = await validate(
        input,
        {
          name: "required",
          keyword: ["required", unique("widgets", "keyword", { ignore: params.id })],
          short_code: ["required", unique("widgets", "short_code", { ignore: params.id })],
        },
        messages,
      );
      if (errors) return backWithErrors(req, errors, input);
      const language = await getCurrentLanguage();
      return attempt(req, () => updateWidget(BigInt(params.id), input, language.id), "Cập nhật bản ghi thành công", "Cập nhật bản ghi không thành công. Hãy thử lại");
    },
  },
  {
    method: "DELETE",
    path: "widget/{id:\\d+}/destroy",
    handler: async ({ req, params }) => {
      const admin = await authorizeHandler(req);
      if (admin instanceof Response) return admin;
      return attempt(req, () => destroyWidget(BigInt(params.id)), "Xóa bản ghi thành công", "Xóa bản ghi không thành công. Hãy thử lại");
    },
  },
  {
    method: "POST",
    path: "widget/saveTranslate",
    handler: async ({ req, input: raw }) => {
      const admin = await authorizeHandler(req);
      if (admin instanceof Response) return admin;
      const input = laravelInput(raw);
      return attempt(req, () => saveWidgetTranslate(input), "Tạo bản dịch thành công", "Tạo bản dịch không thành công. Hãy thử lại");
    },
  },
];
