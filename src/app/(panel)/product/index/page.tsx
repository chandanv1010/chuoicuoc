import { ExternalLinkIcon } from "lucide-react";
import Link from "next/link";
import { AutoSubmitField, OrderInput, SelectableRow, SelectableTable, SelectAllCheckbox, SelectRowCheckbox, StatusSwitch } from "@/components/admin/fields";
import { CreateButton, EmptyRow, hasOtherLanguages, ListCard, ListToolbar, PageHeader, RowActions, Thumb, TranslateBadges } from "@/components/admin/page";
import { AdminPagination, makePaginator } from "@/components/admin/pagination";
import { Badge, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/misc";
import { __ } from "@/lib/lang";
import { getCurrentLanguage } from "@/lib/language";
import { formatMoney } from "@/lib/money";
import { param, translatedLanguageIds, type SearchParams } from "@/server/admin-list";
import { authorize } from "@/server/auth";
import { catalogueNamesOfProducts, firstLanguageUrls, paginateProducts } from "@/modules/product/product";
import { productCatalogueNested } from "@/modules/product/product-catalogue";
import { tableQueryUrl, withRawQuery } from "@/modules/product/query-string";

export const metadata = { title: "Sản phẩm" };

/** number_format($n, 0, ',', '.') — chi con dung cho ton kho; gia dung formatMoney ($24.99) */
const numberFormat = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");

/** GET /product/index — ProductController@index (backend/product/product/index.blade.php) */
export default async function ProductIndex({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await authorize("product.index");
  const sp = await searchParams;
  const language = await getCurrentLanguage();
  const [{ rows, total, perPage, page }, dropdown, multiLang] = await Promise.all([
    paginateProducts(sp, language.id),
    productCatalogueNested(language.id).dropdown("Tất cả danh mục"),
    hasOtherLanguages(),
  ]);
  const ids = rows.map((r) => r.id);
  const [translated, catalogues, urls] = await Promise.all([
    translatedLanguageIds("product_language", "product_id", ids),
    catalogueNamesOfProducts(ids),
    firstLanguageUrls(ids),
  ]);
  const seo = __<{ index: { title: string; table: string }; create: { title: string } }>("messages.product");
  const model = "Product";
  const productCatalogueId = param(sp, "product_catalogue_id") || "0";
  const queryUrl = tableQueryUrl(sp);
  const cols = 7 + (multiLang ? 1 : 0);

  return (
    <>
      <PageHeader title={seo.index.title} crumbs={[{ label: seo.index.title }]} actions={<CreateButton href="/product/create" label={seo.create.title} />} />
      <ListCard title={seo.index.table}>
        {/* ProductService::paginate co dinh 8 dong/trang nen bo o chon so ban ghi */}
        <ListToolbar action="/product/index" searchParams={sp} perpage={false}>
          <AutoSubmitField name="product_catalogue_id" defaultValue={dropdown.some(([k]) => k === productCatalogueId) ? productCatalogueId : "0"} className="w-56">
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
                <TableHead>Sản phẩm</TableHead>
                {multiLang && <TableHead>Bản dịch</TableHead>}
                <TableHead className="w-28 text-right">Giá</TableHead>
                <TableHead className="w-24 text-center">Tồn kho</TableHead>
                <TableHead className="w-24 text-right">Sắp xếp</TableHead>
                <TableHead className="w-28 text-center">Tình trạng</TableHead>
                <TableHead className="w-24 text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && <EmptyRow colSpan={cols} />}
              {rows.map((product) => {
                const id = product.id.toString();
                const stock = product.stock ?? 0;
                return (
                  <SelectableRow key={id} id={id}>
                    <TableCell>
                      <SelectRowCheckbox id={id} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Thumb src={product.image} className="size-12" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="line-clamp-1 font-medium">{product.name}</span>
                            <a href={urls.get(id) ?? "#"} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary" aria-label="Xem ngoài trang">
                              <ExternalLinkIcon className="size-3.5" />
                            </a>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-1 text-xs">
                            {(catalogues.get(id) ?? []).map((cat) =>
                              cat.names.map((name, i) => (
                                <Link key={`${cat.id}-${i}`} href={`/product/index?product_catalogue_id=${cat.id}`}>
                                  <Badge variant="secondary">{name}</Badge>
                                </Link>
                              )),
                            )}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    {multiLang && (
                      <TableCell>
                        <TranslateBadges id={product.id} modeling={model} translatedIds={translated.get(id) ?? new Set()} />
                      </TableCell>
                    )}
                    <TableCell className="text-right tabular-nums">{formatMoney(product.price)}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={stock > 0 ? "success" : "outline"}>{numberFormat(stock)}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end">
                        <OrderInput model={model} id={id} defaultValue={product.order} />
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <StatusSwitch model={model} id={id} value={product.publish} />
                    </TableCell>
                    <TableCell>
                      <RowActions editHref={withRawQuery(`/product/${id}/edit`, queryUrl)} deleteHref={`/product/${id}/delete`} />
                    </TableCell>
                  </SelectableRow>
                );
              })}
            </TableBody>
          </Table>
        </SelectableTable>
        <AdminPagination paginator={makePaginator(total, perPage, page, "/product/index", sp)} />
      </ListCard>
    </>
  );
}
