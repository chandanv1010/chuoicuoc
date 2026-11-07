import { flash } from "@/lib/flash";
import { back, backWithErrors, redirectWith } from "@/lib/http";
import { unique, validate } from "@/lib/validator";
import { authorizeHandler } from "@/server/auth";
import type { FormRoute } from "@/server/routes";
import { laravelInput } from "@/modules/promotion/php";
import { createVoucher, destroyVoucher, updateVoucher } from "./voucher";

/**
 * routes/web/voucher.route.php — VoucherController store/update/destroy.
 * Service goc loi thi `echo $e->getMessage(); die();` -> o day flash error va quay lai.
 */
async function failed(req: Request, e: unknown, message: string) {
  console.error(e);
  await flash({ error: message });
  return back(req, "/voucher/index");
}

export const routes: FormRoute[] = [
  {
    method: "POST",
    path: "voucher/store",
    handler: async ({ req, input }) => {
      const admin = await authorizeHandler(req);
      if (admin instanceof Response) return admin;
      // StoreVoucherRequest
      const errors = await validate(
        laravelInput(input),
        {
          name: "required",
          code: [unique("vouchers", "code")],
          total_quantity: "required",
          max_usage_per_user: "required",
          start_date: "required",
          end_date: "required",
        },
        {
          "name.required": "Bạn chưa nhập tên Voucher",
          "code.unique": "Mã Voucher đã tồn tại",
          "total_quantity.required": "Bạn chưa nhập số lượng",
          "max_usage_per_user.required": "Bạn chưa nhập số lần sử dụng / User",
          "start_date.required": "Bạn chưa nhập ngày bắt đầu",
          "end_date.required": "Bạn chưa nhập ngày kết thúc",
        },
      );
      if (errors) return backWithErrors(req, errors, input);
      try {
        await createVoucher(input);
      } catch (e) {
        return failed(req, e, "Thêm mới bản ghi không thành công. Hãy thử lại");
      }
      return redirectWith(req, "/voucher/index", { success: "Thêm mới bản ghi thành công" });
    },
  },
  {
    method: "POST",
    path: "voucher/{id:\\d+}/update",
    handler: async ({ req, params, input }) => {
      const admin = await authorizeHandler(req);
      if (admin instanceof Response) return admin;
      // UpdateVoucherRequest: khong co rule nao
      try {
        await updateVoucher(BigInt(params.id), input);
      } catch (e) {
        return failed(req, e, "Cập nhật bản ghi không thành công. Hãy thử lại");
      }
      return redirectWith(req, "/voucher/index", { success: "Cập nhật bản ghi thành công" });
    },
  },
  {
    method: "DELETE",
    path: "voucher/{id:\\d+}/destroy",
    handler: async ({ req, params }) => {
      const admin = await authorizeHandler(req);
      if (admin instanceof Response) return admin;
      try {
        await destroyVoucher(BigInt(params.id));
      } catch (e) {
        console.error(e);
        return redirectWith(req, "/voucher/index", { error: "Xóa bản ghi không thành công. Hãy thử lại" });
      }
      return redirectWith(req, "/voucher/index", { success: "Xóa bản ghi thành công" });
    },
  },
];
