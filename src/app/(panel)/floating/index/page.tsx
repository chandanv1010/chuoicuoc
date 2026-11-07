import { PageHeader } from "@/components/admin/page";
import { authorize } from "@/server/auth";
import { getFloatingConfig } from "@/modules/floating/store";
import { FloatingForm } from "./floating-form";

export const metadata = { title: "Nút liên hệ nổi" };

/** GET /floating/index — cau hinh nut lien he noi hai ben hong website (Quan ly Page). */
export default async function Page() {
  await authorize("home.feature.index");
  const config = await getFloatingConfig();
  return (
    <>
      <PageHeader title="Nút liên hệ nổi" crumbs={[{ label: "Quản lý Page" }, { label: "Nút liên hệ nổi" }]} />
      <FloatingForm initial={config} />
    </>
  );
}
