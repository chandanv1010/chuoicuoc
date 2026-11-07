import { backWithErrors, redirectWith, type Input } from "@/lib/http";
import { validate, type Rules } from "@/lib/validator";
import { authorizeHandler } from "@/server/auth";
import type { FormRoute } from "@/server/routes";
import { phpClean } from "@/modules/slide/php";
import { numBetween } from "@/modules/slide/rules";
import { createDealer, destroyDealer, destroyRegistration, LOAI, TRANG_THAI, updateDealer, updateRegistration } from "./dealer";

/** routes/web/dealer.route.php — DealerController + DealerRegistrationController (store/update/destroy) */

// StoreDealerRequest (store + update)
const dealerRules: Rules = {
  name: ["required", "string", "max:191"],
  address: ["nullable", "string", "max:191"],
  phone: ["nullable", "string", "max:50"],
  province_code: ["nullable", "string", "max:20"],
  district_code: ["nullable", "string", "max:20"],
  ward_code: ["nullable", "string", "max:20"],
  latitude: ["nullable", "numeric", numBetween(-90, 90)],
  longitude: ["nullable", "numeric", numBetween(-180, 180)],
  type: ["required", `in:${Object.keys(LOAI).join(",")}`],
  order: "nullable|integer|min:0",
};
const dealerMessages = {
  "name.required": "Bạn chưa nhập tên điểm bán.",
  "name.max": "Tên điểm bán tối đa 191 ký tự.",
  "address.max": "Địa chỉ tối đa 191 ký tự.",
  "phone.max": "Số điện thoại tối đa 50 ký tự.",
  "latitude.numeric": "Vĩ độ phải là số.",
  "latitude.between": "Vĩ độ phải nằm trong khoảng -90 đến 90.",
  "longitude.numeric": "Kinh độ phải là số.",
  "longitude.between": "Kinh độ phải nằm trong khoảng -180 đến 180.",
  "type.required": "Bạn chưa chọn loại điểm bán.",
  "type.in": "Loại điểm bán không hợp lệ.",
  "order.integer": "Thứ tự phải là số nguyên.",
};

// UpdateDealerRegistrationRequest
const registrationRules: Rules = {
  status: ["required", `in:${Object.keys(TRANG_THAI).join(",")}`],
  note: ["nullable", "string", "max:5000"],
};
const registrationMessages = {
  "status.required": "Bạn chưa chọn trạng thái xử lý.",
  "status.in": "Trạng thái xử lý không hợp lệ.",
  "note.max": "Ghi chú tối đa 5000 ký tự.",
};

const DEALER_INDEX = "/dealer/index";
const REG_INDEX = "/dealer/registration/index";

export const routes: FormRoute[] = [
  {
    method: "POST",
    path: "dealer/store",
    handler: async ({ req, input }) => {
      const admin = await authorizeHandler(req);
      if (admin instanceof Response) return admin;
      const errors = await validate(phpClean(input) as Input, dealerRules, dealerMessages);
      if (errors) return backWithErrors(req, errors, input);
      try {
        await createDealer(input);
      } catch (e) {
        console.error("Them diem ban that bai:", e);
        return redirectWith(req, DEALER_INDEX, { error: "Thêm mới bản ghi không thành công. Hãy thử lại" });
      }
      return redirectWith(req, DEALER_INDEX, { success: "Thêm mới bản ghi thành công" });
    },
  },
  {
    method: "POST",
    path: "dealer/{id:\\d+}/update",
    handler: async ({ req, params, input }) => {
      const admin = await authorizeHandler(req);
      if (admin instanceof Response) return admin;
      const errors = await validate(phpClean(input) as Input, dealerRules, dealerMessages);
      if (errors) return backWithErrors(req, errors, input);
      try {
        await updateDealer(BigInt(params.id), input);
      } catch (e) {
        console.error("Cap nhat diem ban that bai:", e);
        return redirectWith(req, DEALER_INDEX, { error: "Cập nhật bản ghi không thành công. Hãy thử lại" });
      }
      return redirectWith(req, DEALER_INDEX, { success: "Cập nhật bản ghi thành công" });
    },
  },
  {
    method: "DELETE",
    path: "dealer/{id:\\d+}/destroy",
    handler: async ({ req, params }) => {
      const admin = await authorizeHandler(req);
      if (admin instanceof Response) return admin;
      try {
        await destroyDealer(BigInt(params.id));
      } catch (e) {
        console.error("Xoa diem ban that bai:", e);
        return redirectWith(req, DEALER_INDEX, { error: "Xóa bản ghi không thành công. Hãy thử lại" });
      }
      return redirectWith(req, DEALER_INDEX, { success: "Xóa bản ghi thành công" });
    },
  },
  {
    method: "POST",
    path: "dealer/registration/{id:\\d+}/update",
    handler: async ({ req, params, input }) => {
      const admin = await authorizeHandler(req);
      if (admin instanceof Response) return admin;
      const errors = await validate(phpClean(input) as Input, registrationRules, registrationMessages);
      if (errors) return backWithErrors(req, errors, input);
      try {
        await updateRegistration(BigInt(params.id), input);
      } catch (e) {
        console.error("Cap nhat don dang ky dai ly that bai:", e);
        return redirectWith(req, REG_INDEX, { error: "Cập nhật bản ghi không thành công. Hãy thử lại" });
      }
      return redirectWith(req, REG_INDEX, { success: "Cập nhật bản ghi thành công" });
    },
  },
  {
    method: "DELETE",
    path: "dealer/registration/{id:\\d+}/destroy",
    handler: async ({ req, params }) => {
      const admin = await authorizeHandler(req);
      if (admin instanceof Response) return admin;
      try {
        await destroyRegistration(BigInt(params.id));
      } catch (e) {
        console.error("Xoa don dang ky dai ly that bai:", e);
        return redirectWith(req, REG_INDEX, { error: "Xóa bản ghi không thành công. Hãy thử lại" });
      }
      return redirectWith(req, REG_INDEX, { success: "Xóa bản ghi thành công" });
    },
  },
];
