import { laravelJson } from "@/modules/product/ajax";
import { ajaxInput } from "@/modules/frontend/shop/ajax";
import { customerOrRedirect } from "@/modules/frontend/shop/customer";
import { formatMoney, pointsToMoney } from "@/lib/money";
import { num } from "@/modules/frontend/shop/php";

/**
 * POST /ajax/cart/checkPoint — Ajax\CartController@checkPoint (middleware CustomerAuth:
 * chua dang nhap -> redirect /login.html, nhanh code 0 cua controller khong bao gio chay).
 */
export async function POST(req: Request) {
  const customer = await customerOrRedirect(req);
  if (customer instanceof Response) return customer;
  const input = await ajaxInput(req);
  const points = Math.trunc(num(input.points));
  const maxPoints = customer.point ?? 0;
  if (points > maxPoints) {
    return laravelJson({ code: 2, max: maxPoints, message: `You only have ${maxPoints} points.` });
  }
  // 1 diem = POINT_VALUE ($1.00)
  const discount = pointsToMoney(points);
  return laravelJson({ code: 1, discount, discount_format: formatMoney(discount) });
}
