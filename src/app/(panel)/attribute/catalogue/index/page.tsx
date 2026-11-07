import { SelectableRow, SelectableTable, SelectAllCheckbox, SelectRowCheckbox, StatusSwitch } from "@/components/admin/fields";
import { CreateButton, EmptyRow, hasOtherLanguages, ListCard, ListToolbar, PageHeader, RowActions, TranslateBadges } from "@/components/admin/page";
import { AdminPagination, makePaginator } from "@/components/admin/pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/misc";
import { __ } from "@/lib/lang";
import { getCurrentLanguage } from "@/lib/language";
import { translatedLanguageIds, type SearchParams } from "@/server/admin-list";
import { authorize } from "@/server/auth";
import { paginateAttributeCatalogues } from "@/modules/attribute/attribute-catalogue";
import { tableQueryUrl, withRawQuery } from "@/modules/product/query-string";

export const metadata = { title: "Loại thuộc tính" };

/** GET /attribute/catalogue/index — AttributeCatalogueController@index */
export default async function AttributeCatalogueIndex({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await authorize("attribute.catalogue.index");
  const sp = await searchParams;
  const language = await getCurrentLanguage();
  const { rows, total, perPage, page } = await paginateAttributeCatalogues(sp, language.id);
  const [translated, multiLang] = await Promise.all([
    translatedLanguageIds("attribute_catalogue_language", "attribute_catalogue_id", rows.map((r) => r.id)),
    hasOtherLanguages(),
  ]);
  const seo = __<{ index: { title: string; table: string }; create: { title: string } }>("messages.attributeCatalogue");
  const model = "AttributeCatalogue";
  const queryUrl = tableQueryUrl(sp);
  const cols = 4 + (multiLang ? 1 : 0);

  return (
    <>
      <PageHeader
        title={seo.index.title}
        description="Các loại thuộc tính dùng để tạo phiên bản sản phẩm (Màu sắc, Kích thước...)"
        crumbs={[{ label: seo.index.title }]}
        actions={<CreateButton href="/attribute/catalogue/create" label={seo.create.title} />}
      />
      <ListCard title={seo.index.table}>
        <ListToolbar action="/attribute/catalogue/index" searchParams={sp} />
        <SelectableTable model={model} ids={rows.map((r) => r.id.toString())}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <SelectAllCheckbox />
                </TableHead>
                <TableHead>Tên loại thuộc tính</TableHead>
                {multiLang && <TableHead>Bản dịch</TableHead>}
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
                      <div className="flex items-center gap-2" style={{ paddingLeft: Math.max(row.level - 1, 0) * 24 }}>
                        {row.level > 1 && <span className="text-muted-foreground">└</span>}
                        <div className="min-w-0">
                          <div className="truncate font-medium">{row.name}</div>
                          {row.canonical && <div className="truncate text-xs text-muted-foreground">/{row.canonical}.html</div>}
                        </div>
                      </div>
                    </TableCell>
                    {multiLang && (
                      <TableCell>
                        <TranslateBadges id={row.id} modeling={model} translatedIds={translated.get(id) ?? new Set()} />
                      </TableCell>
                    )}
                    <TableCell className="text-center">
                      <StatusSwitch model={model} id={id} value={row.publish} />
                    </TableCell>
                    <TableCell>
                      <RowActions editHref={withRawQuery(`/attribute/catalogue/${id}/edit`, queryUrl)} deleteHref={`/attribute/catalogue/${id}/delete`} />
                    </TableCell>
                  </SelectableRow>
                );
              })}
            </TableBody>
          </Table>
        </SelectableTable>
        {/* ban goc withPath(APP_URL.'attribute.catalogue.index') sinh link phan trang sai; da sua */}
        <AdminPagination paginator={makePaginator(total, perPage, page, "/attribute/catalogue/index", sp)} />
      </ListCard>
    </>
  );
}
