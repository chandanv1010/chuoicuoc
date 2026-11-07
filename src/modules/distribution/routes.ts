import { backWithErrors, redirectWith, type Input } from "@/lib/http";
import { validate, type Rules } from "@/lib/validator";
import { authorizeHandler } from "@/server/auth";
import type { FormRoute } from "@/server/routes";
import { phpClean } from "@/modules/slide/php";
import {
  createArea,
  createDistribution,
  destroyArea,
  destroyDistribution,
  updateArea,
  updateDistribution,
} from "./distribution";

/** routes/web/distribution.route.php — DistributionController + DistributionAreaController (store/update/destroy) */

// StoreDistributionRequest (dung cho ca store va update)
const distributionRules: Rules = {
  name: ["required", "string", "max:191"],
  phone: ["required", "string", "max:50"],
  address: ["required", "string", "max:255"],
  province_id: "required|integer|gt:0",
  district_id: "required|integer|gt:0",
  email: ["nullable", "email", "max:191"],
  map: "required|string",
};
const distributionMessages = {
  "name.required": "Bạn chưa nhập tên nhà phân phối.",
  "name.string": "Tên phải là dạng ký tự.",
  "name.max": "Tên tối đa 191 ký tự.",
  "phone.required": "Bạn chưa nhập số điện thoại.",
  "phone.max": "Số điện thoại tối đa 50 ký tự.",
  "address.required": "Bạn chưa nhập địa chỉ.",
  "address.max": "Địa chỉ tối đa 255 ký tự.",
  "province_id.required": "Bạn chưa chọn Miền (phía Bắc / phía Nam).",
  "province_id.gt": "Bạn chưa chọn Miền (phía Bắc / phía Nam).",
  "district_id.required": "Bạn chưa chọn Tỉnh / Thành phố.",
  "district_id.gt": "Bạn chưa chọn Tỉnh / Thành phố.",
  "email.email": "Email chưa đúng định dạng.",
  "email.max": "Email tối đa 191 ký tự.",
  "map.required": "Bạn chưa nhập mã nhúng bản đồ Google Map.",
};

// StoreDistributionAreaRequest
const areaRules: Rules = { name: ["required", "string", "max:191"], parent_id: "required|integer" };
const areaMessages = {
  "name.required": "Bạn chưa nhập tên khu vực.",
  "name.string": "Tên khu vực phải là dạng ký tự.",
  "name.max": "Tên khu vực tối đa 191 ký tự.",
  "parent_id.required": "Bạn chưa chọn danh mục cha.",
  "parent_id.integer": "Danh mục cha phải là dạng số nguyên.",
};

/** Sinh bo store/update/destroy giong nhau cua 2 controller */
function crud(opts: {
  prefix: string;
  index: string;
  rules: Rules;
  messages: Record<string, string>;
  create: (input: Input) => Promise<void>;
  update: (id: bigint, input: Input) => Promise<void>;
  destroy: (id: bigint) => Promise<void>;
}): FormRoute[] {
  return [
    {
      method: "POST",
      path: `${opts.prefix}/store`,
      handler: async ({ req, input }) => {
        const admin = await authorizeHandler(req);
        if (admin instanceof Response) return admin;
        const errors = await validate(phpClean(input) as Input, opts.rules, opts.messages);
        if (errors) return backWithErrors(req, errors, input);
        try {
          await opts.create(input);
        } catch (e) {
          // Laravel: echo $e->getMessage(); die();
          console.error(e);
          return redirectWith(req, opts.index, { error: "Thêm mới bản ghi không thành công. Hãy thử lại" });
        }
        return redirectWith(req, opts.index, { success: "Thêm mới bản ghi thành công" });
      },
    },
    {
      method: "POST",
      path: `${opts.prefix}/{id:\\d+}/update`,
      handler: async ({ req, params, input }) => {
        const admin = await authorizeHandler(req);
        if (admin instanceof Response) return admin;
        const errors = await validate(phpClean(input) as Input, opts.rules, opts.messages);
        if (errors) return backWithErrors(req, errors, input);
        try {
          await opts.update(BigInt(params.id), input);
        } catch (e) {
          console.error(e);
          return redirectWith(req, opts.index, { error: "Cập nhật bản ghi không thành công. Hãy thử lại" });
        }
        return redirectWith(req, opts.index, { success: "Cập nhật bản ghi thành công" });
      },
    },
    {
      method: "DELETE",
      path: `${opts.prefix}/{id:\\d+}/destroy`,
      handler: async ({ req, params }) => {
        const admin = await authorizeHandler(req);
        if (admin instanceof Response) return admin;
        try {
          await opts.destroy(BigInt(params.id));
        } catch (e) {
          console.error(e);
          return redirectWith(req, opts.index, { error: "Xóa bản ghi không thành công. Hãy thử lại" });
        }
        return redirectWith(req, opts.index, { success: "Xóa bản ghi thành công" });
      },
    },
  ];
}

export const routes: FormRoute[] = [
  ...crud({
    prefix: "distribution/area",
    index: "/distribution/area/index",
    rules: areaRules,
    messages: areaMessages,
    create: createArea,
    update: updateArea,
    destroy: destroyArea,
  }),
  ...crud({
    prefix: "distribution",
    index: "/distribution/index",
    rules: distributionRules,
    messages: distributionMessages,
    create: createDistribution,
    update: updateDistribution,
    destroy: destroyDistribution,
  }),
];
