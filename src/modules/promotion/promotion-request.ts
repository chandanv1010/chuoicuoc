import "server-only";
import type { Input } from "@/lib/http";
import { unique, validate, type ErrorMap, type RuleFn } from "@/lib/validator";
import { toCents } from "@/lib/money";
import { inArrayLoose, laravelInput, looseEqZero, parseDmyHi, phpCompare } from "./php";
import { PromotionEnum } from "./promotion";

/**
 * StorePromotionRequest / UpdatePromotionRequest + cac rule trong
 * app/Rules/Promotion/* + validator custom_date_format / custom_after (AppServiceProvider).
 */

/** custom_date_format: DateTime::createFromFormat('d/m/Y H:i', $value) !== false */
export const customDateFormat: RuleFn = ({ value }) => {
  if (value === null || value === undefined || (typeof value === "string" && value.trim() === "")) return null;
  return parseDmyHi(String(value).trim()) ? null : "custom_date_format";
};

/** custom_after:field — ngay ket thuc phai lon hon ngay trong field kia. */
export function customAfter(other: string): RuleFn {
  return ({ value, input }) => {
    if (value === null || value === undefined || (typeof value === "string" && value.trim() === "")) return null;
    const start = parseDmyHi(String(input[other] ?? "").trim());
    const end = parseDmyHi(String(value).trim());
    // Laravel: Carbon nem exception (trang 500) neu 1 trong 2 sai dinh dang — o day bo qua
    if (!start || !end) return null;
    return end.getTime() > start.getTime() ? null : "custom_after";
  };
}

type Arr = Record<string, unknown>;
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : v && typeof v === "object" ? Object.values(v) : []);
const isset = (v: unknown) => v !== null && v !== undefined;

/** OrderAmountRangeRule */
function orderAmountRange(data: Arr | null | undefined): string[] {
  const fails: string[] = [];
  const from = isset(data?.amountFrom) ? list(data!.amountFrom) : null;
  const to = isset(data?.amountTo) ? list(data!.amountTo) : null;
  const value = isset(data?.amountValue) ? list(data!.amountValue) : null;
  if (!from || !to || !value || from.length === 0 || from[0] === null || from[0] === "") {
    fails.push("Bạn phải khởi tạo giá trị cho khoảng khuyến mại");
  }
  if (value && (inArrayLoose(0, value) || inArrayLoose("", value))) {
    fails.push("Cấu hình giá trị khuyến mãi không hợp lệ");
  }
  let conflict = false;
  const froms = from ?? [];
  const tos = to ?? [];
  outer: for (let i = 0; i < froms.length; i++) {
    // so sanh theo xu (USD); ban VND: convert_price bo dau cham
    const from1 = toCents(froms[i]);
    const to1 = toCents(tos[i]);
    if (phpCompare(from1, to1) >= 0) {
      conflict = true;
      break;
    }
    for (let j = 0; j < froms.length; j++) {
      if (i !== j) {
        const from2 = toCents(froms[j]);
        const to2 = toCents(tos[j]);
        if (phpCompare(from1, to2) <= 0 && phpCompare(to1, from2) >= 0) {
          conflict = true;
          break outer;
        }
      }
    }
  }
  if (conflict) fails.push("Có xung đột giữa các khoảng giá trị khuyến mại! Hãy kiểm tra và thử lại");
  return fails;
}

/** ProductAndQuantityRule */
function productAndQuantity(input: Input): string[] {
  const fails: string[] = [];
  const pq = (input.product_and_quantity ?? {}) as Arr;
  if (looseEqZero(pq.quantity)) fails.push("Bạn phải nhập số lượng mua tối thiểu để hưởng chiết khấu");
  if (looseEqZero(pq.discountValue)) fails.push("Bạn phải nhập vào giá trị của chiết khấu");
  if (!isset(input.object)) fails.push("Bạn chưa chọn đối tượng áp dụng chiết khấu");
  return fails;
}

const hasAnyNull = (q: unknown) => list(q).some((x) => x === "null");
const invalidQuantity = (q: unknown) => list(q).some((x) => looseEqZero(x));

/** BuyProductTakeGiftRule */
function buyProductTakeGift(input: Input): string[] {
  const fails: string[] = [];
  const products = input.products as Arr | null | undefined;
  const gifts = input.product_gifts as Arr | null | undefined;
  if (!isset(products) && !isset(gifts)) fails.push("Bạn chưa chọn sản phẩm mua và quà tặng");
  if (!isset(products) && isset(gifts)) fails.push("Bạn chưa chọn sản phẩm mua");
  if (!isset(gifts) && isset(products)) fails.push("Bạn chưa chọn quà tặng");
  if (isset(products) && hasAnyNull(products!.quantity)) fails.push("Bạn phải nhập số lượng cho từng sản phẩm.");
  if (isset(products) && invalidQuantity(products!.quantity)) fails.push("Số lượng sản phẩm tối thiểu là 1.");
  if (isset(gifts) && hasAnyNull(gifts!.quantity)) fails.push("Bạn phải nhập số lượng cho từng quà tặng.");
  if (isset(gifts) && invalidQuantity(gifts!.quantity)) fails.push("Số lượng quà tặng tối thiểu là 1.");
  return fails;
}

/** BuyComboRule */
function buyCombo(input: Input): string[] {
  const combos = input.product_combos as Arr | null | undefined;
  if (!isset(combos?.id)) return ["Bạn chưa chọn sản phẩm mua"];
  const fails: string[] = [];
  if (hasAnyNull(combos!.quantity)) fails.push("Bạn phải nhập số lượng cho từng sản phẩm.");
  if (invalidQuantity(combos!.quantity)) fails.push("Số lượng sản phẩm tối thiểu là 1.");
  if (!isset(combos!.price)) fails.push("Bạn chưa nhập tổng tiền");
  return fails;
}

/**
 * Chay validate giong FormRequest. id = null: Store, co id: Update.
 * Tra ve ErrorMap (thu tu: name, code, startDate, endDate, method) hoac null.
 */
export async function validatePromotion(raw: Input, id: string | null): Promise<ErrorMap | null> {
  const input = laravelInput(raw);
  const neverEnd = Boolean(input.neverEndDate);
  const messages: Record<string, string> = {
    "name.required": "Bạn chưa nhập tên của khuyến mại",
    "code.required": "Bạn chưa nhập từ khóa của khuyến mại",
    "startDate.required": "Bạn chưa nhập vào ngày bắt đầu khuyến mại",
    "startDate.custom_date_format": "Ngày bắt đầu khuyến mãi không đúng định dạng",
    "endDate.required": "Bạn chưa nhập vào ngày bắt đầu khuyến mại",
    "endDate.custom_date_format": "Ngày kết thúc khuyến mãi không đúng định dạng",
  };
  if (!neverEnd) {
    messages["endDate.required"] = "Bạn chưa chọn ngày kết thúc của khuyến mại";
    messages["endDate.custom_after"] = "Ngày kết thúc khuyến mại phải lớn hơn ngày bắt đầu khuyến mại";
  }
  const rules = {
    name: "required",
    // Store: unique:promotions (cot code). Update: 'unique:promotions,id, '.$this->id —
    // ban goc so code voi cot id (bo qua chinh no); giu nguyen.
    code: ["required", id === null ? unique("promotions", "code") : unique("promotions", "id", { ignore: id })],
    startDate: ["required", customDateFormat],
    ...(neverEnd ? {} : { endDate: ["required", customDateFormat, customAfter("startDate")] }),
  };
  const errors: ErrorMap = (await validate(input, rules, messages)) ?? {};

  // rule cua 'method'
  const method = input.method;
  let methodErrors: string[] = [];
  const isStore = id === null;
  if (method === PromotionEnum.ORDER_AMOUNT_RANGE) {
    methodErrors = orderAmountRange(input.promotion_order_amount_range as Arr | null);
  } else if (method === PromotionEnum.PRODUCT_AND_QUANTITY) {
    methodErrors = productAndQuantity(input);
  } else if (isStore && method === PromotionEnum.BUY_PRODUCT_TAKE_GIFT) {
    methodErrors = buyProductTakeGift(input);
  } else if (isStore && method === PromotionEnum.BUY_COMBO) {
    methodErrors = buyCombo(input);
  } else if (method === null || method === undefined) {
    methodErrors = ["The method field is required."];
  } else if (method === "none") {
    // 'required|not_in:none'
    methodErrors = ["Bạn chưa chọn hình thức khuyến mại"];
  }
  if (methodErrors.length) errors.method = methodErrors;
  return Object.keys(errors).length ? errors : null;
}
