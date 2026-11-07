import Link from "next/link";
import { AutoSubmitField, OrderInput, SelectableRow, SelectableTable, SelectAllCheckbox, SelectRowCheckbox, StatusSwitch } from "@/components/admin/fields";
import { CreateButton, EmptyRow, hasOtherLanguages, ListCard, ListToolbar, PageHeader, RowActions, TranslateBadges } from "@/components/admin/page";
import { AdminPagination, makePaginator } from "@/components/admin/pagination";
import { Badge, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/misc";
import { __ } from "@/lib/lang";
import { getCurrentLanguage } from "@/lib/language";
import { param, translatedLanguageIds, type SearchParams } from "@/server/admin-list";
import { authorize } from "@/server/auth";
import { catalogueNamesOfAttributes, paginateAttributes } from "@/modules/attribute/attribute";
import { attributeCatalogueNested } from "@/modules/attribute/attribute-catalogue";
import { tableQueryUrl, withRawQuery } from "@/modules/product/query-string";

export const metadata = { title: "Thuộc tính" };

/** GET /attribute/index — AttributeController@index */
export default async function AttributeIndex({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await authorize("attribute.index");
  const sp = await searchParams;
  const language = await getCurrentLanguage();
  const [{ rows, total, perPage, page }, dropdown, multiLang] = await Promise.all([
    paginateAttributes(sp, language.id),
    attributeCatalogueNested(language.id).dropdown("Tất cả loại thuộc tính"),
    hasOtherLanguages(),
  ]);
  const ids = rows.map((r) => r.id);
  const [translated, catalogues] = await Promise.all([translatedLanguageIds("attribute_language", "attribute_id", ids), catalogueNamesOfAttributes(ids)]);
  const seo = __<{ index: { title: string; table: string }; create: { title: string } }>("messages.attribute");
  const model = "Attribute";
  const catId = param(sp, "attribute_catalogue_id") || "0";
  const queryUrl = tableQueryUrl(sp);
  const cols = 5 + (multiLang ? 1 : 0);

  return (
    <>
      <PageHeader
        title={seo.index.title}
        description="Giá trị của các loại thuộc tính (Đỏ, Xanh, S, M, L...)"
        crumbs={[{ label: seo.index.title }]}
        actions={<CreateButton href="/attribute/create" label={seo.create.title} />}
      />
      <ListCard title={seo.index.table}>
        <ListToolbar action="/attribute/index" searchParams={sp}>
          <AutoSubmitField name="attribute_catalogue_id" defaultValue={dropdown.some(([k]) => k === catId) ? catId : "0"} className="w-56">
            {dropdown.map(([value, label]) => (
              <option key={value} value={value}>
                {label.replace(/\|-----/g, "— ")}
              </option>
            ))}
          </AutoSubmitField>
        </ListToolbar>
        <SelectableTable model={model} ids={ids.map(String)}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <SelectAllCheckbox />
                </TableHead>
                <TableHead>Thuộc tính</TableHead>
                {multiLang && <TableHead>Bản dịch</TableHead>}
                <TableHead className="w-24 text-right">Sắp xếp</TableHead>
                <TableHead className="w-28 text-center">Tình trạng</TableHead>
                <TableHead className="w-24 text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && <EmptyRow colSpan={cols} />}
              {rows.map((attribute) => {
                const id = attribute.id.toString();
                return (
                  <SelectableRow key={id} id={id}>
                    <TableCell>
                      <SelectRowCheckbox id={id} />
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{attribute.name}</div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {(catalogues.get(id) ?? []).map((cat) =>
                          cat.names.map((name, i) => (
                            <Link key={`${cat.id}-${i}`} href={`/attribute/index?attribute_catalogue_id=${cat.id}`}>
                              <Badge variant="secondary">{name}</Badge>
                            </Link>
                          )),
                        )}
                      </div>
                    </TableCell>
                    {multiLang && (
                      <TableCell>
                        <TranslateBadges id={attribute.id} modeling={model} translatedIds={translated.get(id) ?? new Set()} />
                      </TableCell>
                    )}
                    <TableCell>
                      <div className="flex justify-end">
                        <OrderInput model={model} id={id} defaultValue={attribute.order} />
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <StatusSwitch model={model} id={id} value={attribute.publish} />
                    </TableCell>
                    <TableCell>
                      <RowActions editHref={withRawQuery(`/attribute/${id}/edit`, queryUrl)} deleteHref={`/attribute/${id}/delete`} />
                    </TableCell>
                  </SelectableRow>
                );
              })}
            </TableBody>
          </Table>
        </SelectableTable>
        {/* ban goc withPath(APP_URL.'attribute.index') sinh link phan trang sai; da sua */}
        <AdminPagination paginator={makePaginator(total, perPage, page, "/attribute/index", sp)} />
      </ListCard>
    </>
  );
}
