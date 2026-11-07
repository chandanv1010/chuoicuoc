import { backWithErrors, redirectWith, type Input } from "@/lib/http";
import { unique, validate } from "@/lib/validator";
import { authorizeHandler } from "@/server/auth";
import type { FormRoute } from "@/server/routes";
import {
  createCustomer,
  createCustomerCatalogue,
  createSource,
  destroyCustomer,
  destroyCustomerCatalogue,
  destroySource,
  updateCustomer,
  updateCustomerCatalogue,
  updateSource,
} from "./customer";

/**
 * routes/web/customer.route.php — CustomerCatalogueController, CustomerController, SourceController
 * (store/update/destroy). Ban goc: service loi thi `echo $e->getMessage(); die();` -> o day flash error.
 * customer/catalogue/updatePermission: controller khong co method (Laravel 500) -> khong khai bao.
 */
type Action = (input: Input, id: bigint) => Promise<void>;

function handler(opts: {
  rules?: (id?: string) => Parameters<typeof validate>[1];
  messages?: Record<string, string>;
  action: Action;
  index: string;
  ok: string;
  fail: string;
}): FormRoute["handler"] {
  return async ({ req, params, input }) => {
    const admin = await authorizeHandler(req);
    if (admin instanceof Response) return admin;
    if (opts.rules) {
      const errors = await validate(input, opts.rules(params.id), opts.messages);
      if (errors) return backWithErrors(req, errors, input);
    }
    try {
      await opts.action(input, params.id ? BigInt(params.id) : 0n);
    } catch (e) {
      console.error(e);
      return redirectWith(req, opts.index, { error: opts.fail });
    }
    return redirectWith(req, opts.index, { success: opts.ok });
  };
}

const CREATE = { ok: "Thêm mới bản ghi thành công", fail: "Thêm mới bản ghi không thành công. Hãy thử lại" };
const UPDATE = { ok: "Cập nhật bản ghi thành công", fail: "Cập nhật bản ghi không thành công. Hãy thử lại" };
const DESTROY = { ok: "Xóa bản ghi thành công", fail: "Xóa bản ghi không thành công. Hãy thử lại" };

// StoreCustomerCatalogueRequest (dung cho ca store va update)
const catalogueRules = () => ({ name: "required|string" });
const catalogueMessages = {
  "name.required": "Bạn chưa nhập Nhóm thành viên",
  "name.string": "Nhóm thành viên phải là dạng ký tự",
};

const customerMessages = {
  "email.required": "Bạn chưa nhập vào email.",
  "email.email": "Email chưa đúng định dạng. Ví dụ: abc@gmail.com",
  "email.unique": "Email đã tồn tại. Hãy chọn email khác",
  "email.string": "Email phải là dạng ký tự",
  "email.max": "Độ dài email tối đa 191 ký tự",
  "name.required": "Bạn chưa nhập Họ Tên",
  "name.string": "Họ Tên phải là dạng ký tự",
  "customer_catalogue_id.gt": "Bạn chưa chọn nhóm thành viên",
  "password.required": "Bạn chưa nhập vào mật khẩu.",
  "re_password.required": "Bạn phải nhập vào ô Nhập lại mật khẩu.",
  "re_password.same": "Mật khẩu không khớp.",
};

const sourceMessages = {
  "name.required": "Bạn chưa nhập tên của nguồn khách",
  "keyword.required": "Bạn chưa nhập từ khóa của nguồn khách",
  "keyword.unique": "Từ khóa đã tồn tại, hãy chọn từ khóa khác",
};
const sourceUpdateMessages = {
  "name.required": "Bạn chưa nhập tên của Nguồn khách",
  "keyword.required": "Bạn chưa nhập từ khóa của Nguồn khách",
  "keyword.unique": "Từ khóa đã tồn tại, hãy chọn từ khóa khác",
};

export const routes: FormRoute[] = [
  /* ---------- customer/catalogue ---------- */
  {
    method: "POST",
    path: "customer/catalogue/store",
    handler: handler({ rules: catalogueRules, messages: catalogueMessages, action: (i) => createCustomerCatalogue(i), index: "/customer/catalogue/index", ...CREATE }),
  },
  {
    method: "POST",
    path: "customer/catalogue/{id:\\d+}/update",
    handler: handler({ rules: catalogueRules, messages: catalogueMessages, action: (i, id) => updateCustomerCatalogue(id, i), index: "/customer/catalogue/index", ...UPDATE }),
  },
  {
    method: "DELETE",
    path: "customer/catalogue/{id:\\d+}/destroy",
    handler: handler({ action: (_i, id) => destroyCustomerCatalogue(id), index: "/customer/catalogue/index", ...DESTROY }),
  },
  /* ---------- customer ---------- */
  {
    method: "POST",
    path: "customer/store",
    handler: handler({
      // StoreCustomerRequest (re_password: Laravel dung lai sau rule implicit 'required' loi)
      rules: () => ({
        email: ["required", "string", "email", unique("customers", "email"), "max:191"],
        name: "required|string",
        customer_catalogue_id: "gt:0",
        password: "required|string|min:6",
        re_password: "bail|required|string|same:password",
      }),
      messages: customerMessages,
      action: (i) => createCustomer(i),
      index: "/customer/index",
      ...CREATE,
    }),
  },
  {
    method: "POST",
    path: "customer/{id:\\d+}/update",
    handler: handler({
      // UpdateCustomerRequest: unique:customers,email, {id}
      rules: (id) => ({
        email: ["required", "string", "email", unique("customers", "email", { ignore: id }), "max:191"],
        name: "required|string",
        customer_catalogue_id: "gt:0",
      }),
      messages: customerMessages,
      action: (i, id) => updateCustomer(id, i),
      index: "/customer/index",
      ...UPDATE,
    }),
  },
  {
    method: "DELETE",
    path: "customer/{id:\\d+}/destroy",
    handler: handler({ action: (_i, id) => destroyCustomer(id), index: "/customer/index", ...DESTROY }),
  },
  /* ---------- source ---------- */
  {
    method: "POST",
    path: "source/store",
    handler: handler({
      rules: () => ({ name: "required", keyword: ["required", unique("sources", "keyword")] }),
      messages: sourceMessages,
      action: (i) => createSource(i),
      index: "/source/index",
      ...CREATE,
    }),
  },
  {
    method: "POST",
    path: "source/{id:\\d+}/update",
    handler: handler({
      rules: (id) => ({ name: "required", keyword: ["required", unique("sources", "keyword", { ignore: id })] }),
      messages: sourceUpdateMessages,
      action: (i, id) => updateSource(id, i),
      index: "/source/index",
      ...UPDATE,
    }),
  },
  {
    method: "DELETE",
    path: "source/{id:\\d+}/destroy",
    handler: handler({ action: (_i, id) => destroySource(id), index: "/source/index", ...DESTROY }),
  },
];
