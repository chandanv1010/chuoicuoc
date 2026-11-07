import { AdminForm, PageHeader, Section } from "@/components/admin/page";
import { authorize } from "@/server/auth";
import { PermissionMatrix } from "@/modules/user/permission-matrix";
import { permissionMatrix } from "@/modules/user/service";

export const metadata = { title: "Phân quyền" };

/** GET /user/catalogue/permission — UserCatalogueController@permission (user/catalogue/permission.blade.php) */
export default async function Page() {
  await authorize("user.catalogue.permission");
  const { catalogues, permissions, granted } = await permissionMatrix();
  // Nhom quyen theo module = tien to canonical (post.catalogue.index -> post)
  const groups = new Map<string, { id: string; name: string; canonical: string }[]>();
  for (const p of permissions) {
    const module = p.canonical.split(".")[0] || "khác";
    if (!groups.has(module)) groups.set(module, []);
    groups.get(module)!.push({ id: p.id.toString(), name: p.name, canonical: p.canonical });
  }
  return (
    <>
      <PageHeader
        title="Phân quyền"
        description="Tick quyền cho từng nhóm thành viên. Bấm tên quyền để bật / tắt cho mọi nhóm."
        crumbs={[{ label: "Nhóm thành viên", href: "/user/catalogue/index" }, { label: "Phân quyền" }]}
      />
      <AdminForm
        action="/user/catalogue/updatePermission"
        saveMode="single"
        cancelHref="/user/catalogue/index"
        main={
          <Section title="Cấp quyền">
            <PermissionMatrix
              catalogues={catalogues.map((c) => ({ id: c.id.toString(), name: c.name }))}
              groups={[...groups].map(([module, items]) => ({ module, items }))}
              granted={[...granted]}
            />
          </Section>
        }
      />
    </>
  );
}
