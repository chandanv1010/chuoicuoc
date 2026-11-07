import { redirectWith } from "@/lib/http";
import { authorizeHandler } from "@/server/auth";
import type { FormRoute } from "@/server/routes";
import { laravelInput } from "@/modules/dashboard/ui";
import { createLecturer, destroyLecturer, updateLecturer } from "./service";

/**
 * routes/web/core.route.php (prefix lecturer) — LecturerController store/update/destroy.
 * Ban goc khong chay duoc: StoreLecturerRequest/UpdateLecturerRequest khong ton tai (500),
 * model Lecturer khong khai bao $fillable (MassAssignmentException), destroy redirect toi
 * route 'lectuter.index' sai ten (500 sau khi da xoa). O day lam theo y do: khong validate,
 * luu cac cot cua form, xong ve lecturer.index.
 */
async function attempt(req: Request, fn: () => Promise<unknown>, ok: string, fail: string) {
  try {
    await fn();
  } catch (e) {
    console.error(e);
    return redirectWith(req, "/lecturer/index", { error: fail });
  }
  return redirectWith(req, "/lecturer/index", { success: ok });
}

export const routes: FormRoute[] = [
  {
    method: "POST",
    path: "lecturer/store",
    handler: async ({ req, input }) => {
      const admin = await authorizeHandler(req);
      if (admin instanceof Response) return admin;
      return attempt(req, () => createLecturer(laravelInput(input)), "Thêm mới bản ghi thành công", "Thêm mới bản ghi không thành công. Hãy thử lại");
    },
  },
  {
    method: "POST",
    path: "lecturer/{id:\\d+}/update",
    handler: async ({ req, params, input }) => {
      const admin = await authorizeHandler(req);
      if (admin instanceof Response) return admin;
      return attempt(req, () => updateLecturer(BigInt(params.id), laravelInput(input)), "Cập nhật bản ghi thành công", "Cập nhật bản ghi không thành công. Hãy thử lại");
    },
  },
  {
    method: "DELETE",
    path: "lecturer/{id:\\d+}/destroy",
    handler: async ({ req, params }) => {
      const admin = await authorizeHandler(req);
      if (admin instanceof Response) return admin;
      return attempt(req, () => destroyLecturer(BigInt(params.id)), "Xóa bản ghi thành công", "Xóa bản ghi không thành công. Hãy thử lại");
    },
  },
];
