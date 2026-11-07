import { notFound } from "next/navigation";
import { getCurrentLanguage } from "@/lib/language";
import { authorize } from "@/server/auth";
import { allMenuCatalogues, convertMenu, findMenuCatalogue, rootMenusOfCatalogue } from "@/modules/menu/menu";
import { MenuStore } from "@/modules/menu/menu-store";

/** GET /menu/{id}/editMenu — MenuController@editMenu (cap nhat menu cap 1) */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await authorize("menu.update");
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const language = await getCurrentLanguage();
  const [menus, menuCatalogues, menuCatalogue] = await Promise.all([
    rootMenusOfCatalogue(BigInt(id), language.id),
    allMenuCatalogues(),
    findMenuCatalogue(BigInt(id)),
  ]);
  if (!menuCatalogue) notFound();
  const menuList = convertMenu(menus);
  return <MenuStore method="update" menuCatalogues={menuCatalogues} menuCatalogue={menuCatalogue} menuList={menuList} id={id} />;
}
