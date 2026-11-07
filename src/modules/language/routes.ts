import { flash } from "@/lib/flash";
import { back, backWithErrors, redirectWith } from "@/lib/http";
import { unique, validate, type RuleFn } from "@/lib/validator";
import { authorizeHandler } from "@/server/auth";
import type { FormRoute } from "@/server/routes";
import { laravelInput } from "@/modules/dashboard/ui";
import { createLanguage, destroyLanguage, saveTranslate, translateCanonicalTaken, updateLanguage } from "./service";

/** routes/web/core.route.php (prefix language) — LanguageController store/update/destroy/storeTranslate */

const messages = {
  "name.required": "Bạn chưa nhập vào tên ngôn ngữ.",
  "canonical.required": "Bạn chưa nhập vào từ khóa của ngôn ngữ.",
  "canonical.unique": "Từ khóa đã tồn tại hãy chọn từ khóa khác",
};

const translateMessages = {
  "translate_name.required": "Bạn chưa nhập vào tên ngôn ngữ.",
  "translate_canonical.required": "Bạn chưa nhập vào từ khóa của ngôn ngữ.",
  "translate_canonical.unique": "Từ khóa đã tồn tại hãy chọn từ khóa khác",
  "translate_canonical.taken": "Đường dẫn đã tồn tại. Hãy chọn đường dẫn khác",
};

type Option = { id: string; languageId: string; model: string };

function optionOf(input: Record<string, unknown>): Option {
  const o = (input.option && typeof input.option === "object" ? input.option : {}) as Record<string, unknown>;
  return { id: String(o.id ?? ""), languageId: String(o.languageId ?? ""), model: String(o.model ?? "") };
}

export const routes: FormRoute[] = [
  {
    method: "POST",
    path: "language/store",
    handler: async ({ req, input: raw }) => {
      const admin = await authorizeHandler(req);
      if (admin instanceof Response) return admin;
      const input = laravelInput(raw);
      const errors = await validate(input, { name: "required", canonical: ["required", unique("languages", "canonical")] }, messages);
      if (errors) return backWithErrors(req, errors, input);
      try {
        await createLanguage(input, admin.id);
      } catch (e) {
        console.error(e);
        return redirectWith(req, "/language/index", { error: "Thêm mới bản ghi không thành công. Hãy thử lại" });
      }
      return redirectWith(req, "/language/index", { success: "Thêm mới bản ghi thành công" });
    },
  },
  {
    method: "POST",
    path: "language/{id:\\d+}/update",
    handler: async ({ req, params, input: raw }) => {
      const admin = await authorizeHandler(req);
      if (admin instanceof Response) return admin;
      const input = laravelInput(raw);
      const errors = await validate(
        input,
        { name: "required", canonical: ["required", unique("languages", "canonical", { ignore: params.id })] },
        messages,
      );
      if (errors) return backWithErrors(req, errors, input);
      try {
        await updateLanguage(BigInt(params.id), input);
      } catch (e) {
        console.error(e);
        return redirectWith(req, "/language/index", { error: "Cập nhật bản ghi không thành công. Hãy thử lại" });
      }
      return redirectWith(req, "/language/index", { success: "Cập nhật bản ghi thành công" });
    },
  },
  {
    method: "DELETE",
    path: "language/{id:\\d+}/destroy",
    handler: async ({ req, params }) => {
      const admin = await authorizeHandler(req);
      if (admin instanceof Response) return admin;
      try {
        await destroyLanguage(BigInt(params.id));
      } catch (e) {
        console.error(e);
        return redirectWith(req, "/language/index", { error: "Xóa bản ghi không thành công. Hãy thử lại" });
      }
      return redirectWith(req, "/language/index", { success: "Xóa bản ghi thành công" });
    },
  },
  {
    // LanguageController@storeTranslate + TranslateRequest
    method: "POST",
    path: "language/storeTranslate",
    handler: async ({ req, input: raw }) => {
      const admin = await authorizeHandler(req);
      if (admin instanceof Response) return admin;
      const input = laravelInput(raw);
      const option = optionOf(input);
      const notTaken: RuleFn = async ({ value }) =>
        value !== null && value !== undefined && (await translateCanonicalTaken(String(value), option.languageId, option.id)) ? "taken" : null;
      const errors = await validate(input, { translate_name: "required", translate_canonical: ["required", notTaken] }, translateMessages);
      if (errors) return backWithErrors(req, errors, input);
      try {
        await saveTranslate(option, input);
      } catch (e) {
        console.error(e);
        await flash({ error: "Có vấn đề xảy ra, Hãy Thử lại" });
        return back(req);
      }
      await flash({ success: "Cập nhật bản ghi thành công" });
      return back(req);
    },
  },
];
