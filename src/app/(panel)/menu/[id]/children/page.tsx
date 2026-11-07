import { notFound } from "next/navigation";
import { getCurrentLanguage } from "@/lib/language";
import { authorize } from "@/server/auth";
import { childMenus, convertMenu, findMenu } from "@/modules/menu/menu";
import { MenuChildren } from "@/modules/menu/menu-store";

/** GET /menu/{id}/children — MenuController@children (quan ly menu con) */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await authorize("menu.create");
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const language = await getCurrentLanguage();
  const menuBread = await findMenu(BigInt(id), language.id);
  if (!menuBread) notFound();
  const menuList = convertMenu(await childMenus(menuBread.id, language.id));
  // Blade: $menuBread->languages->first()->pivot->name (Laravel loi 500 neu menu chua co ban dich)
  return <MenuChildren menuId={menuBread.id} menuName={menuBread.name ?? ""} catalogueId={menuBread.menu_catalogue_id} menuList={menuList} />;
}
