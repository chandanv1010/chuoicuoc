import { backWithErrors, redirectWith } from "@/lib/http";
import { isRootEmail, ROOT_EMAIL, rootLocked } from "@/modules/system/site-type";
import { unique, validate } from "@/lib/validator";
import { authorizeHandler } from "@/server/auth";
import type { FormRoute } from "@/server/routes";
import { laravelInput } from "@/modules/dashboard/ui";
import {
  createPermission,
  createUser,
  createUserCatalogue,
  destroyUser,
  destroyUserCatalogue,
  setPermission,
  updatePermission,
  updateUser,
  updateUserCatalogue,
} from "./service";

/**
 * routes/web/user.route.php — UserCatalogueController, UserController, PermissionController
 * (store / update / destroy / updatePermission). Controller goc khong authorize() o cac
 * action ghi, chi can dang nhap (middleware 'admin').
 */

const catalogueMessages = {
  "name.required": "Bạn chưa nhập Nhóm thành viên",
  "name.string": "Nhóm thành viên phải là dạng ký tự",
};

const userMessages = {
  "email.required": "Bạn chưa nhập vào email.",
  "email.email": "Email chưa đúng định dạng. Ví dụ: abc@gmail.com",
  "email.unique": "Email đã tồn tại. Hãy chọn email khác",
  "email.string": "Email phải là dạng ký tự",
  "email.max": "Độ dài email tối đa 191 ký tự",
  "name.required": "Bạn chưa nhập Họ Tên",
  "name.string": "Họ Tên phải là dạng ký tự",
  "user_catalogue_id.gt": "Bạn chưa chọn nhóm thành viên",
  "password.required": "Bạn chưa nhập vào mật khẩu.",
  "re_password.required": "Bạn phải nhập vào ô Nhập lại mật khẩu.",
  "re_password.same": "Mật khẩu không khớp.",
};

const permissionMessages = {
  "name.required": "Bạn chưa nhập vào tên ngôn ngữ.",
  "canonical.required": "Bạn chưa nhập vào từ khóa của ngôn ngữ.",
  "canonical.unique": "Từ khóa đã tồn tại hãy chọn từ khóa khác",
};

/** Service goc: catch -> echo $e->getMessage(); die(); — o day doi thanh flash error. */
async function attempt(req: Request, fn: () => Promise<unknown>, okPath: string, ok: string, failPath: string, fail: string) {
  try {
    await fn();
  } catch (e) {
    console.error(e);
    return redirectWith(req, failPath, { error: fail });
  }
  return redirectWith(req, okPath, { success: ok });
}

export const routes: FormRoute[] = [
  // ---------------------------------------------------------- user/catalogue
  {
    method: "POST",
    path: "user/catalogue/store",
    handler: async ({ req, input: raw }) => {
      const admin = await authorizeHandler(req);
      if (admin instanceof Response) return admin;
      const input = laravelInput(raw);
      const errors = await validate(input, { name: "required|string" }, catalogueMessages);
      if (errors) return backWithErrors(req, errors, input);
      return attempt(req, () => createUserCatalogue(input), "/user/catalogue/index", "Thêm mới bản ghi thành công", "/user/catalogue/index", "Thêm mới bản ghi không thành công. Hãy thử lại");
    },
  },
  {
    method: "POST",
    path: "user/catalogue/{id:\\d+}/update",
    handler: async ({ req, params, input: raw }) => {
      const admin = await authorizeHandler(req);
      if (admin instanceof Response) return admin;
      const input = laravelInput(raw);
      const errors = await validate(input, { name: "required|string" }, catalogueMessages);
      if (errors) return backWithErrors(req, errors, input);
      return attempt(req, () => updateUserCatalogue(BigInt(params.id), input), "/user/catalogue/index", "Cập nhật bản ghi thành công", "/user/catalogue/index", "Cập nhật bản ghi không thành công. Hãy thử lại");
    },
  },
  {
    method: "DELETE",
    path: "user/catalogue/{id:\\d+}/destroy",
    handler: async ({ req, params }) => {
      const admin = await authorizeHandler(req);
      if (admin instanceof Response) return admin;
      return attempt(req, () => destroyUserCatalogue(BigInt(params.id)), "/user/catalogue/index", "Xóa bản ghi thành công", "/user/catalogue/index", "Xóa bản ghi không thành công. Hãy thử lại");
    },
  },
  {
    method: "POST",
    path: "user/catalogue/updatePermission",
    handler: async ({ req, input }) => {
      const admin = await authorizeHandler(req);
      if (admin instanceof Response) return admin;
      return attempt(req, () => setPermission(input), "/user/catalogue/index", "Cập nhật quyền thành công", "/user/catalogue/index", "Có vấn đề xảy ra, Hãy thử lại");
    },
  },
  // ---------------------------------------------------------- user
  {
    method: "POST",
    path: "user/store",
    handler: async ({ req, input: raw }) => {
      const admin = await authorizeHandler(req);
      if (admin instanceof Response) return admin;
      const input = laravelInput(raw);
      const errors = await validate(
        input,
        {
          email: ["required", "string", "email", unique("users", "email"), "max:191"],
          name: "required|string",
          user_catalogue_id: "gt:0",
          password: "required|string|min:6",
          re_password: "required|string|same:password",
        },
        userMessages,
      );
      if (errors) return backWithErrors(req, errors, input);
      const { re_password: _skip, ...payload } = input;
      void _skip;
      return attempt(req, () => createUser(payload), "/user/index", "Thêm mới bản ghi thành công", "/user/index", "Thêm mới bản ghi không thành công. Hãy thử lại");
    },
  },
  {
    method: "POST",
    path: "user/{id:\\d+}/update",
    handler: async ({ req, params, input: raw }) => {
      const admin = await authorizeHandler(req);
      if (admin instanceof Response) return admin;
      const input = laravelInput(raw);
      const errors = await validate(
        input,
        {
          email: ["required", "string", "email", unique("users", "email", { ignore: params.id }), "max:191"],
          name: "required|string",
          user_catalogue_id: "gt:0",
        },
        userMessages,
      );
      if (errors) return backWithErrors(req, errors, input);
      if (await rootLocked(admin.email, params.id)) return redirectWith(req, "/user/index", { error: "Tài khoản gốc được khóa: chỉ chính tài khoản đó mới sửa, khóa hoặc xóa được." });
      // Email cua tai khoan goc co dinh (nhan dien quyen goc bang email)
      if (isRootEmail(admin.email) && String(admin.id) === params.id) input.email = ROOT_EMAIL;
      return attempt(req, () => updateUser(BigInt(params.id), input), "/user/index", "Cập nhật bản ghi thành công", "/user/index", "Cập nhật bản ghi không thành công. Hãy thử lại");
    },
  },
  {
    method: "DELETE",
    path: "user/{id:\\d+}/destroy",
    handler: async ({ req, params }) => {
      const admin = await authorizeHandler(req);
      if (admin instanceof Response) return admin;
      if (await rootLocked(admin.email, params.id)) return redirectWith(req, "/user/index", { error: "Tài khoản gốc được khóa: chỉ chính tài khoản đó mới sửa, khóa hoặc xóa được." });
      return attempt(req, () => destroyUser(BigInt(params.id)), "/user/index", "Xóa bản ghi thành công", "/user/index", "Xóa bản ghi không thành công. Hãy thử lại");
    },
  },
  // ---------------------------------------------------------- permission
  {
    method: "POST",
    path: "permission/store",
    handler: async ({ req, input: raw }) => {
      const admin = await authorizeHandler(req);
      if (admin instanceof Response) return admin;
      const input = laravelInput(raw);
      const errors = await validate(input, { name: "required", canonical: ["required", unique("permissions", "canonical")] }, permissionMessages);
      if (errors) return backWithErrors(req, errors, input);
      // Thanh cong quay ve permission.create (giong goc)
      return attempt(req, () => createPermission(input), "/permission/create", "Thêm mới bản ghi thành công", "/permission/index", "Thêm mới bản ghi không thành công. Hãy thử lại");
    },
  },
  {
    method: "POST",
    path: "permission/{id:\\d+}/update",
    handler: async ({ req, params, input: raw }) => {
      const admin = await authorizeHandler(req);
      if (admin instanceof Response) return admin;
      const input = laravelInput(raw);
      const errors = await validate(
        input,
        { name: "required", canonical: ["required", unique("permissions", "canonical", { ignore: params.id })] },
        permissionMessages,
      );
      if (errors) return backWithErrors(req, errors, input);
      return attempt(req, () => updatePermission(BigInt(params.id), input), "/permission/index", "Cập nhật bản ghi thành công", "/permission/index", "Cập nhật bản ghi không thành công. Hãy thử lại");
    },
  },
  {
    method: "DELETE",
    path: "permission/{id:\\d+}/destroy",
    handler: async ({ req }) => {
      const admin = await authorizeHandler(req);
      if (admin instanceof Response) return admin;
      // PermissionService::destroy() de trong (tra ve null) -> luon bao loi, khong xoa gi
      return redirectWith(req, "/permission/index", { error: "Xóa bản ghi không thành công. Hãy thử lại" });
    },
  },
];
