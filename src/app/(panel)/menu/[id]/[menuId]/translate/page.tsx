import { notFound } from "next/navigation";
import { AdminForm, PageHeader, Section } from "@/components/admin/page";
import { Input } from "@/components/ui/form-controls";
import { Badge } from "@/components/ui/misc";
import { db } from "@/lib/db";
import { image } from "@/lib/helpers";
import { __ } from "@/lib/lang";
import { getCurrentLanguage } from "@/lib/language";
import { requireAdmin } from "@/server/auth";
import { e } from "@/modules/slide/php";
import { buildMenu, findMenuCatalogue, findMenuItemTranslate, menusOfCatalogueByLft } from "@/modules/menu/menu";

/**
 * GET /menu/{languageId}/{id}/translate — MenuController@translate (view menu/menu/translate.blade.php).
 * Thu muc [id] o day la languageId (Next bat buoc cung ten slug voi /menu/[id]/...).
 * Ban goc khong goi authorize() o action nay.
 */
export default async function Page({ params }: { params: Promise<{ id: string; menuId: string }> }) {
  await requireAdmin();
  const { id: languageId, menuId: id } = await params;
  if (!/^\d+$/.test(languageId) || !/^\d+$/.test(id)) notFound();
  const [language, menuCatalogue, current] = await Promise.all([
    db.languages.findFirst({ where: { id: BigInt(languageId), deleted_at: null } }),
    findMenuCatalogue(BigInt(id)),
    getCurrentLanguage(),
  ]);
  if (!language || !menuCatalogue) notFound();
  const menus = buildMenu(await findMenuItemTranslate(await menusOfCatalogueByLft(BigInt(id), current.id), BigInt(languageId)));
  const seo = __<{ index: { title: string }; translate: { title: string } }>("messages.menu");
  const title = `${seo.translate.title.replace("{language}", language.name)} ${menuCatalogue.name}`;

  return (
    <>
      <PageHeader
        title={title}
        description="Hệ thống tự lấy bản dịch đã có của từng menu. Bỏ trống tên bản dịch thì menu đó không được lưu."
        crumbs={[{ label: seo.index.title, href: "/menu/index" }, { label: menuCatalogue.name, href: `/menu/${id}/edit` }, { label: `Dịch ${language.name}` }]}
      />
      <AdminForm
        action={`/menu/${languageId}/saveTranslate`}
        cancelHref={`/menu/${id}/edit`}
        saveMode="single"
        main={
          <Section
            title="Danh sách bản dịch"
            actions={
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image(current.image)} alt="" className="size-4 rounded-sm object-cover" /> {current.name} →{/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image(language.image)} alt="" className="size-4 rounded-sm object-cover" /> {language.name}
              </span>
            }
          >
            {menus.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Vị trí này chưa có menu nào.</p>}
            <div className="grid gap-3">
              {menus.map((val) => {
                const depth = val.position.split(".").length - 1;
                return (
                  <div key={val.id.toString()} className="grid gap-3 rounded-lg border p-3 md:grid-cols-2" style={{ marginLeft: depth * 16 }}>
                    <div className="grid content-start gap-1.5">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono">
                          {val.position}
                        </Badge>
                        <span className="truncate font-medium">{val.has_lang ? e(val.name) : "(No name)"}</span>
                      </div>
                      <div className="truncate text-xs text-muted-foreground">{e(val.canonical) || "—"}</div>
                    </div>
                    <div className="grid gap-2">
                      <Input name="translate[name][]" defaultValue={e(val.translate_name)} placeholder={`Tên menu (${language.name})`} autoComplete="off" aria-label="Tên bản dịch" />
                      <Input name="translate[canonical][]" defaultValue={e(val.translate_canonical)} placeholder={`Đường dẫn (${language.name})`} autoComplete="off" aria-label="Đường dẫn bản dịch" />
                      <input type="hidden" name="translate[id][]" value={val.id.toString()} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>
        }
      />
    </>
  );
}
