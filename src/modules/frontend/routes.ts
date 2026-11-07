import type { FormRoute } from "@/server/routes";
import { infoRoutes } from "./info/routes";
import { routes as shopRoutes } from "./shop/routes";

/** Form POST/PUT/DELETE cua module frontend (xem src/server/routes.ts). */
export const routes: FormRoute[] = [
  // dang-ky-dai-ly, contact.html, yeu-cau-tu-van (trang tinh WACO)
  ...infoRoutes,
  // tai khoan khach hang + gio hang / dat hang
  ...shopRoutes,
];
