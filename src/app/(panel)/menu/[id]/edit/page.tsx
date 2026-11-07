import { LanguagesIcon, PencilIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader, Section } from "@/components/admin/page";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/misc";
import { image } from "@/lib/helpers";
import { __ } from "@/lib/lang";
import { getCurrentLanguage, getLanguages, getLocale } from "@/lib/language";
import { authorize } from "@/server/auth";
import { findMenuCatalogue, menusOfCatalogue, recursive, type MenuNode } from "@/modules/menu/menu";
import { MenuTree, type TreeNode } from "@/modules/menu/menu-tree";

/** GET /menu/{id}/edit — MenuController@edit (view backend/menu/menu/show.blade.php: cay nestable -> cay keo tha @dnd-kit) */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await authorize("menu.update");
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const language = await getCurrentLanguage();
  const [menus, menuCatalogue, languages] = await Promise.all([menusOfCatalogue(BigInt(id), language.id), findMenuCatalogue(BigInt(id)), getLanguages()]);
  if (!menuCatalogue) notFound();
  // session('app_locale')
  const sessionLocale = await getLocale();
  const seo = __<{ index: { title: string }; show: { title: string } }>("messages.menu");
  const tree = toTree(recursive(menus));
  const others = languages.filter((l) => l.canonical !== sessionLocale);

  return (
    <>
      <PageHeader
        title={menuCatalogue.name}
        description={`Từ khóa: ${menuCatalogue.keyword}`}
        crumbs={[{ label: seo.index.title, href: "/menu/index" }, { label: menuCatalogue.name }]}
        actions={
          <Button asChild>
            <Link href={`/menu/${id}/editMenu`}>
              <PencilIcon /> Cập nhật menu cấp 1
            </Link>
          </Button>
        }
      />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <Section title={seo.show.title} description="Kéo biểu tượng ⋮⋮ lên/xuống để đổi thứ tự, kéo sang phải/trái để đổi cấp. Thay đổi được lưu ngay.">
          <MenuTree initial={tree} catalogueId={id} />
        </Section>
        <div className="grid content-start gap-5">
          {others.length > 0 && (
            <Section title="Bản dịch" description="Dịch tên và đường dẫn menu sang ngôn ngữ khác.">
              <div className="grid gap-2">
                {others.map((l) => (
                  <Button key={l.id.toString()} asChild variant="outline" className="justify-start">
                    <Link href={`/menu/${l.id}/${id}/translate`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={image(l.image)} alt="" className="size-4 rounded-sm object-cover" />
                      Dịch sang {l.name}
                      <LanguagesIcon className="ml-auto" />
                    </Link>
                  </Button>
                ))}
              </div>
            </Section>
          )}
          <Section title="Hướng dẫn">
            <ul className="list-disc space-y-1.5 pl-4 text-sm text-muted-foreground">
              <li>
                Thêm mới hoặc sửa menu cấp 1 bằng nút <b className="text-foreground">Cập nhật menu cấp 1</b>.
              </li>
              <li>Kéo thả để thay đổi vị trí và cấp của menu.</li>
              <li>
                Tạo menu con bằng nút <b className="text-foreground">Menu con</b> trên từng dòng.
              </li>
              <li>
                Hỗ trợ tối đa <Badge variant="warning">5 cấp</Badge>
              </li>
            </ul>
          </Section>
        </div>
      </div>
    </>
  );
}

/** recursive_menu(): ten "(No name)" khi menu chua co ban dich ngon ngu hien tai */
function toTree(nodes: MenuNode[]): TreeNode[] {
  return nodes.map((n) => ({ id: Number(n.item.id), name: n.item.has_lang ? (n.item.name ?? "") : "(No name)", children: toTree(n.children) }));
}
