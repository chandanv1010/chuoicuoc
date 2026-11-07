import { notFound } from "next/navigation";
import { DeleteConfirm, PageHeader } from "@/components/admin/page";
import { __ } from "@/lib/lang";
import { authorize } from "@/server/auth";
import { findMenuCatalogue } from "@/modules/menu/menu";

/** GET /menu/{id}/delete — MenuController@delete (view backend/menu/menu/delete.blade.php) */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await authorize("menu.destroy");
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const menuCatalogue = await findMenuCatalogue(BigInt(id));
  if (!menuCatalogue) notFound();
  const seo = __<Record<string, { title: string }>>("messages.menu");
  return (
    <>
      <PageHeader title="Xóa vị trí menu" crumbs={[{ label: seo.index.title, href: "/menu/index" }, { label: "Xóa" }]} />
      <DeleteConfirm action={`/menu/${menuCatalogue.id}/destroy`} name={menuCatalogue.name} title="Xóa vị trí menu" backHref="/menu/index">
        <p className="text-destructive">Toàn bộ menu thuộc vị trí này cũng sẽ bị xóa.</p>
      </DeleteConfirm>
    </>
  );
}
