import { redirect } from "next/navigation";

/** Chức năng giỏ hàng đã tắt cho site này (catalog). Chuyển về trang chủ. */
export default function DisabledCartPage() {
  redirect("/");
}
