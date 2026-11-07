import { AdminForm, FormErrors, PageHeader, Section } from "@/components/admin/page";
import { errorBag, oldInput } from "@/lib/flash";
import { __ } from "@/lib/lang";
import { e } from "@/modules/slide/php";
import { MenuCatalogueField, MenuRowsEditor, type MenuRowValue } from "./menu-builder";

/**
 * resources/views/backend/menu/menu/{store,children}.blade.php
 * + component/{catalogue,list,popup}.blade.php (giao dien shadcn, hanh vi menu.js viet lai trong menu-builder.tsx)
 */
type Catalogue = { id: bigint; name: string };
type MenuList = Record<string, unknown[]> | null;

/** store.blade.php (create + editMenu) — POST menu/store */
export async function MenuStore({
  method,
  menuCatalogues,
  menuCatalogue,
  menuList,
  id,
}: {
  method: "create" | "update";
  menuCatalogues: Catalogue[];
  menuCatalogue: Catalogue | null;
  menuList: MenuList;
  id?: string;
}) {
  const [old, errors] = await Promise.all([oldInput(), errorBag()]);
  const seo = __<Record<string, { title: string }>>("messages.menu");
  const title = method === "create" ? seo.create.title : `Cập nhật menu cấp 1 — ${menuCatalogue?.name ?? ""}`;
  const catalogueId = e(old("menu_catalogue_id", menuCatalogue ? menuCatalogue.id.toString() : "0"));
  const crumbs = [{ label: seo.index.title, href: "/menu/index" }, ...(menuCatalogue ? [{ label: menuCatalogue.name, href: `/menu/${menuCatalogue.id}/edit` }] : []), { label: method === "create" ? "Thêm mới" : "Menu cấp 1" }];
  return (
    <>
      <PageHeader title={title} crumbs={crumbs} />
      <FormErrors />
      <AdminForm
        action="/menu/store"
        cancelHref={menuCatalogue ? `/menu/${menuCatalogue.id}/edit` : "/menu/index"}
        saveMode="single"
        main={
          <>
            <input type="hidden" name="redirect" value={id ?? "0"} />
            <Section title="Vị trí menu" description="Website có các vị trí hiển thị cho từng menu. Chọn vị trí bạn muốn hiển thị.">
              <MenuCatalogueField
                catalogues={menuCatalogues.map((c) => ({ id: c.id.toString(), name: c.name }))}
                defaultValue={catalogueId}
                error={errors.first("menu_catalogue_id")}
              />
            </Section>
            <Section title="Danh sách menu">
              <MenuRowsEditor
                level1
                defaultValue={toRows(old<Record<string, unknown> | null>("menu", menuList ?? null))}
                models={__<Record<string, string>>("module.model")}
                error={errors.first("menu.name")}
              />
            </Section>
          </>
        }
      />
    </>
  );
}

/** children.blade.php — POST menu/{id}/saveChildren */
export async function MenuChildren({ menuId, menuName, catalogueId, menuList }: { menuId: bigint; menuName: string; catalogueId: bigint; menuList: MenuList }) {
  const [old, errors] = await Promise.all([oldInput(), errorBag()]);
  const seo = __<{ index: { title: string }; create: { children: string } }>("messages.menu");
  return (
    <>
      <PageHeader
        title={seo.create.children + menuName}
        crumbs={[{ label: seo.index.title, href: "/menu/index" }, { label: "Danh sách menu", href: `/menu/${catalogueId}/edit` }, { label: "Menu con" }]}
      />
      <FormErrors />
      <AdminForm
        action={`/menu/${menuId}/saveChildren`}
        cancelHref={`/menu/${catalogueId}/edit`}
        saveMode="single"
        main={
          <Section title={`Menu con của “${menuName}”`} description="Các menu dưới đây sẽ là menu con trực tiếp của mục này.">
            <MenuRowsEditor
              level1={false}
              defaultValue={toRows(old<Record<string, unknown> | null>("menu", menuList ?? null))}
              models={__<Record<string, string>>("module.model")}
              error={errors.first("menu.name")}
            />
          </Section>
        }
      />
    </>
  );
}

/** {name:[], canonical:[], ...} (convertMenu hoac old input) -> danh sach dong */
function toRows(menu: Record<string, unknown> | null): MenuRowValue[] {
  if (!menu || typeof menu !== "object") return [];
  const col = (k: string): unknown[] => {
    const v = menu[k];
    return Array.isArray(v) ? v : v && typeof v === "object" ? Object.values(v) : [];
  };
  return col("name").map((name, i) => ({
    name: e(name),
    canonical: e(col("canonical")[i]),
    icon: e(col("icon")[i]),
    order: e(col("order")[i]) || "0",
    // data-menu-id = (int)$menu['id'][$key]
    id: String(Number.parseInt(e(col("id")[i]), 10) || 0),
  }));
}
