import { CreateButton, EmptyRow, hasOtherLanguages, ListCard, ListToolbar, PageHeader, RowActions, Thumb, TranslateBadges } from "@/components/admin/page";
import { AdminPagination, makePaginator } from "@/components/admin/pagination";
import { OrderInput, SelectableRow, SelectableTable, SelectAllCheckbox, SelectRowCheckbox, StatusSwitch } from "@/components/admin/fields";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/misc";
import { __ } from "@/lib/lang";
import { getCurrentLanguage } from "@/lib/language";
import { translatedLanguageIds, type SearchParams } from "@/server/admin-list";
import { authorize } from "@/server/auth";
import { paginatePostCatalogues } from "@/modules/post/post-catalogue";

export const metadata = { title: "Nhóm bài viết" };

/** GET /post/catalogue/index — PostCatalogueController@index */
export default async function PostCatalogueIndex({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await authorize("post.catalogue.index");
  const sp = await searchParams;
  const language = await getCurrentLanguage();
  const { rows, total, perPage, page } = await paginatePostCatalogues(sp, language.id);
  const [translated, multiLang] = await Promise.all([
    translatedLanguageIds("post_catalogue_language", "post_catalogue_id", rows.map((r) => r.id)),
    hasOtherLanguages(),
  ]);
  const seo = __<{ index: { title: string; table: string }; create: { title: string } }>("messages.postCatalogue");
  const model = "PostCatalogue";
  const cols = 5 + (multiLang ? 1 : 0);

  return (
    <>
      <PageHeader
        title={seo.index.title}
        crumbs={[{ label: seo.index.title }]}
        actions={<CreateButton href="/post/catalogue/create" label={seo.create.title} />}
      />
      <ListCard title={seo.index.table}>
        <ListToolbar action="/post/catalogue/index" searchParams={sp} />
        <SelectableTable model={model} ids={rows.map((r) => r.id.toString())}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <SelectAllCheckbox />
                </TableHead>
                <TableHead>Tên nhóm</TableHead>
                {multiLang && <TableHead>Bản dịch</TableHead>}
                <TableHead className="w-24 text-right">Sắp xếp</TableHead>
                <TableHead className="w-28 text-center">Tình trạng</TableHead>
                <TableHead className="w-24 text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && <EmptyRow colSpan={cols} />}
              {rows.map((row) => {
                const id = row.id.toString();
                return (
                  <SelectableRow key={id} id={id}>
                    <TableCell>
                      <SelectRowCheckbox id={id} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3" style={{ paddingLeft: Math.max(row.level - 1, 0) * 24 }}>
                        {row.level > 1 && <span className="text-muted-foreground">└</span>}
                        <Thumb src={row.image} className="size-9" />
                        <div className="min-w-0">
                          <div className="truncate font-medium">{row.name}</div>
                          <div className="truncate text-xs text-muted-foreground">/{row.canonical}.html</div>
                        </div>
                      </div>
                    </TableCell>
                    {multiLang && (
                      <TableCell>
                        <TranslateBadges id={row.id} modeling={model} translatedIds={translated.get(id) ?? new Set()} />
                      </TableCell>
                    )}
                    <TableCell>
                      <div className="flex justify-end">
                        <OrderInput model={model} id={id} defaultValue={row.order} />
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <StatusSwitch model={model} id={id} value={row.publish} />
                    </TableCell>
                    <TableCell>
                      <RowActions editHref={`/post/catalogue/${id}/edit`} deleteHref={`/post/catalogue/${id}/delete`} />
                    </TableCell>
                  </SelectableRow>
                );
              })}
            </TableBody>
          </Table>
        </SelectableTable>
        <AdminPagination paginator={makePaginator(total, perPage, page, "/post/catalogue/index", sp)} />
      </ListCard>
    </>
  );
}
