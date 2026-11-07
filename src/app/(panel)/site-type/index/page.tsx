import { forbidden } from "next/navigation";
import { PageHeader } from "@/components/admin/page";
import { requireAdmin } from "@/server/auth";
import { getSiteType, isRootEmail } from "@/modules/system/site-type";
import { SiteTypeForm } from "./site-type-form";

export const metadata = { title: "Loại website" };

/** GET /site-type/index — chon website ban hang / tin tuc. Chi tai khoan goc (nguoi lam web) vao duoc. */
export default async function Page() {
  const admin = await requireAdmin();
  if (!isRootEmail(admin.email)) forbidden();
  const type = await getSiteType();
  return (
    <>
      <PageHeader title="Loại website" crumbs={[{ label: "Cấu hình chung" }, { label: "Loại website" }]} description="Chỉ tài khoản gốc thấy và đổi được mục này." />
      <SiteTypeForm initial={type} />
    </>
  );
}
