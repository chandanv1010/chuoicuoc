import { authorize } from "@/server/auth";
import { allMenuCatalogues } from "@/modules/menu/menu";
import { MenuStore } from "@/modules/menu/menu-store";

/** GET /menu/create — MenuController@create */
export default async function Page() {
  await authorize("menu.create");
  const menuCatalogues = await allMenuCatalogues();
  return <MenuStore method="create" menuCatalogues={menuCatalogues} menuCatalogue={null} menuList={null} />;
}
