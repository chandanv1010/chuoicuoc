import { CreateButton, EmptyRow, ListCard, ListToolbar, PageHeader, RowActions } from "@/components/admin/page";
import { AdminPagination, makePaginator } from "@/components/admin/pagination";
import { SelectableRow, SelectableTable, SelectAllCheckbox, SelectRowCheckbox, StatusSwitch } from "@/components/admin/fields";
import { Badge, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/misc";
import { __ } from "@/lib/lang";
import { getCurrentLanguage } from "@/lib/language";
import type { SearchParams } from "@/server/admin-list";
import { authorize } from "@/server/auth";
import { e } from "@/modules/slide/php";
import { itemsOf, paginateSlides } from "@/modules/slide/slide";
import { SlideOrderStrip } from "@/modules/slide/slide-items";

export const metadata = { title: "Quản lý slide" };

/** GET /slide/index — SlideController@index (view backend/slide/index + component/filter, table) */
export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await authorize("slide.index");
  const sp = await searchParams;
  const language = await getCurrentLanguage();
  const { rows, total, perPage, page } = await paginateSlides(sp);
  const seo = __<{ index: { title: string; table: string }; create: { title: string } }>("messages.slide");
  const model = "Slide";

  return (
    <>
      <PageHeader title={seo.index.title} crumbs={[{ label: seo.index.title }]} actions={<CreateButton href="/slide/create" label="Thêm mới slide" />} />
      <ListCard title={seo.index.table} description="Kéo thả ảnh trong cột “Hình ảnh” để đổi thứ tự hiển thị (lưu ngay).">
        <ListToolbar action="/slide/index" searchParams={sp} />
        <SelectableTable model={model} ids={rows.map((r) => r.id.toString())}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <SelectAllCheckbox />
                </TableHead>
                <TableHead>Tên slide</TableHead>
                <TableHead>Từ khóa</TableHead>
                <TableHead>Hình ảnh</TableHead>
                <TableHead className="w-28 text-center">Tình trạng</TableHead>
                <TableHead className="w-24 text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && <EmptyRow colSpan={6} />}
              {rows.map((slide) => {
                const id = slide.id.toString();
                const items = itemsOf(slide.item, language.id).map((it) => ({
                  image: e(it.image),
                  name: e(it.name),
                  alt: e(it.alt),
                  description: e(it.description),
                  canonical: e(it.canonical),
                  window: e(it.window),
                }));
                return (
                  <SelectableRow key={id} id={id}>
                    <TableCell>
                      <SelectRowCheckbox id={id} />
                    </TableCell>
                    <TableCell className="font-medium">{slide.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-mono">
                        {slide.keyword}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <SlideOrderStrip slideId={id} items={items} />
                    </TableCell>
                    <TableCell className="text-center">
                      <StatusSwitch model={model} id={id} value={slide.publish} />
                    </TableCell>
                    <TableCell>
                      <RowActions editHref={`/slide/${id}/edit`} deleteHref={`/slide/${id}/delete`} />
                    </TableCell>
                  </SelectableRow>
                );
              })}
            </TableBody>
          </Table>
        </SelectableTable>
        <AdminPagination paginator={makePaginator(total, perPage, page, "/slide/index", sp)} />
      </ListCard>
    </>
  );
}
