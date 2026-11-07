import Link from "next/link";
import { AutoSubmitField, OrderInput, SelectableRow, SelectableTable, SelectAllCheckbox, SelectRowCheckbox, StatusSwitch } from "@/components/admin/fields";
import { CreateButton, EmptyRow, hasOtherLanguages, ListCard, ListToolbar, PageHeader, RowActions, Thumb, TranslateBadges } from "@/components/admin/page";
import { AdminPagination, makePaginator } from "@/components/admin/pagination";
import { Badge, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/misc";
import { __ } from "@/lib/lang";
import { getCurrentLanguage } from "@/lib/language";
import { param, translatedLanguageIds, type SearchParams } from "@/server/admin-list";
import { authorize } from "@/server/auth";
import { catalogueNamesOfPosts, paginatePosts } from "@/modules/post/post";
import { postCatalogueNested } from "@/modules/post/post-catalogue";

export const metadata = { title: "Bài viết" };

/** GET /post/index — PostController@index */
export default async function PostIndex({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await authorize("post.index");
  const sp = await searchParams;
  const language = await getCurrentLanguage();
  const [{ rows, total, perPage, page }, dropdown, multiLang] = await Promise.all([
    paginatePosts(sp, language.id),
    postCatalogueNested(language.id).dropdown("Tất cả nhóm"),
    hasOtherLanguages(),
  ]);
  const ids = rows.map((r) => r.id);
  const [translated, catalogues] = await Promise.all([translatedLanguageIds("post_language", "post_id", ids), catalogueNamesOfPosts(ids)]);
  const seo = __<{ index: { title: string; table: string }; create: { title: string } }>("messages.post");
  const model = "Post";

  return (
    <>
      <PageHeader title={seo.index.title} crumbs={[{ label: seo.index.title }]} actions={<CreateButton href="/post/create" label={seo.create.title} />} />
      <ListCard title={seo.index.table}>
        <ListToolbar action="/post/index" searchParams={sp} perpage={false}>
          <AutoSubmitField name="post_catalogue_id" defaultValue={param(sp, "post_catalogue_id") ?? "0"} className="w-56">
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
                <TableHead>Bài viết</TableHead>
                {multiLang && <TableHead>Bản dịch</TableHead>}
                <TableHead className="w-24 text-right">Sắp xếp</TableHead>
                <TableHead className="w-28 text-center">Tình trạng</TableHead>
                <TableHead className="w-24 text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && <EmptyRow colSpan={multiLang ? 6 : 5} />}
              {rows.map((post) => {
                const id = post.id.toString();
                return (
                  <SelectableRow key={id} id={id}>
                    <TableCell>
                      <SelectRowCheckbox id={id} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Thumb src={post.image} className="h-11 w-16" />
                        <div className="min-w-0">
                          <div className="line-clamp-1 font-medium">{post.name}</div>
                          <div className="mt-1 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                            <span>{post.viewed ?? 0} lượt xem</span>
                            {(catalogues.get(id) ?? []).map((cat) =>
                              cat.names.map((name, i) => (
                                <Link key={`${cat.id}-${i}`} href={`/post/index?post_catalogue_id=${cat.id}`}>
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
                        <TranslateBadges id={post.id} modeling={model} translatedIds={translated.get(id) ?? new Set()} />
                      </TableCell>
                    )}
                    <TableCell>
                      <div className="flex justify-end">
                        <OrderInput model={model} id={id} defaultValue={post.order} />
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <StatusSwitch model={model} id={id} value={post.publish} />
                    </TableCell>
                    <TableCell>
                      <RowActions editHref={`/post/${id}/edit`} deleteHref={`/post/${id}/delete`} />
                    </TableCell>
                  </SelectableRow>
                );
              })}
            </TableBody>
          </Table>
        </SelectableTable>
        <AdminPagination paginator={makePaginator(total, perPage, page, "/post/index", sp)} />
      </ListCard>
    </>
  );
}
