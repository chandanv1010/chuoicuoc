// Danh sach route form cua tung module. File nay da khai bao san moi module:
// moi module chi sua file src/modules/<module>/routes.ts cua minh.
import type { FormRoute } from "@/server/routes";
import { routes as auth } from "./auth/routes";
import { routes as dashboard } from "./dashboard/routes";
import { routes as language } from "./language/routes";
import { routes as system } from "./system/routes";
import { routes as widget } from "./widget/routes";
import { routes as introduce } from "./introduce/routes";
import { routes as user } from "./user/routes";
import { routes as post } from "./post/routes";
import { routes as product } from "./product/routes";
import { routes as attribute } from "./attribute/routes";
import { routes as order } from "./order/routes";
import { routes as customer } from "./customer/routes";
import { routes as promotion } from "./promotion/routes";
import { routes as voucher } from "./voucher/routes";
import { routes as review } from "./review/routes";
import { routes as contact } from "./contact/routes";
import { routes as slide } from "./slide/routes";
import { routes as menu } from "./menu/routes";
import { routes as distribution } from "./distribution/routes";
import { routes as homeFeature } from "./home-feature/routes";
import { routes as dealer } from "./dealer/routes";
import { routes as report } from "./report/routes";
import { routes as lecturer } from "./lecturer/routes";
import { routes as frontend } from "./frontend/routes";
import { routes as social } from "./social/routes";
import { routes as marketplace } from "./marketplace/routes";
import { routes as design } from "./design/routes";
import { routes as curate } from "./curate/routes";

export const formRoutes: FormRoute[] = [
  ...auth,
  ...dashboard,
  ...language,
  ...system,
  ...widget,
  ...introduce,
  ...user,
  ...post,
  ...product,
  ...attribute,
  ...order,
  ...customer,
  ...promotion,
  ...voucher,
  ...review,
  ...contact,
  ...slide,
  ...menu,
  ...distribution,
  ...homeFeature,
  ...dealer,
  ...report,
  ...lecturer,
  ...frontend,
  ...social,
  ...marketplace,
  ...design,
  ...curate,
];
