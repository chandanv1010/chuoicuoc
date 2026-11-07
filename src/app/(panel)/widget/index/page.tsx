import Link from "next/link";
import { CreateButton, EmptyRow, ListCard, ListToolbar, PageHeader, RowActions } from "@/components/admin/page";
import { AdminPagination, makePaginator } from "@/components/admin/pagination";
import { SelectableRow, SelectableTable, SelectAllCheckbox, SelectRowCheckbox, StatusSwitch } from "@/components/admin/fields";
import { Badge, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/misc";
import { image } from "@/lib/helpers";
import { __ } from "@/lib/lang";
import { getLanguages, getLocale } from "@/lib/language";
import type { SearchParams } from "@/server/admin-list";
import { authorize } from "@/server/auth";
import { descriptionMap, paginateWidgets } from "@/modules/widget/service";

export const metadata = { title: "Quản lý widget" };

/** GET /widget/index — WidgetController@index (widget/index.blade.php + component/table) */
export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await authorize("widget.index");
  const sp = await searchParams;
  const [{ rows, total, perPage, page }, languages, locale] = await Promise.all([paginateWidgets(sp), getLanguages(), getLocale()]);
  const others = languages.filter((l) => l.canonical !== locale);
  const model = "Widget";
  const title = __<string>("messages.widget.index.title");
  const cols = 6 + (others.length ? 1 : 0);
  return (
    <>
      <PageHeader title={title} crumbs={[{ label: title }]} actions={<CreateButton href="/widget/create" label="Thêm mới widget" />} />
      <ListCard title={__<string>("messages.widget.index.table")}>
        <ListToolbar action="/widget/index" searchParams={sp} />
        <SelectableTable model={model} ids={rows.map((r) => r.id.toString())}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <SelectAllCheckbox />
                </TableHead>
                <TableHead>Tên widget</TableHead>
                <TableHead>Từ khóa / Short code</TableHead>
                <TableHead>Ghi chú</TableHead>
                {others.length > 0 && <TableHead>Bản dịch</TableHead>}
                <TableHead className="w-28 text-center">Tình trạng</TableHead>
                <TableHead className="w-24 text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && <EmptyRow colSpan={cols} />}
              {rows.map((widget) => {
                const id = widget.id.toString();
                const desc = descriptionMap(widget.description);
                return (
                  <SelectableRow key={id} id={id}>
                    <TableCell>
                      <SelectRowCheckbox id={id} />
                    </TableCell>
                    <TableCell className="font-medium">{widget.name}</TableCell>
                    <TableCell>
                      <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{widget.keyword}</code>
                      <div className="mt-1 max-w-64 truncate font-mono text-xs text-muted-foreground">{widget.short_code ?? "-"}</div>
                    </TableCell>
                    <TableCell className="max-w-64 text-xs text-muted-foreground">{widget.note ?? ""}</TableCell>
                    {others.length > 0 && (
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {others.map((language) => {
                            // isset($widget->description[$language->id]): null cung la chua dich
                            const v = typeof desc === "object" ? desc[language.id.toString()] : undefined;
                            const done = v !== null && v !== undefined;
                            return (
                              <Link key={language.id.toString()} href={`/widget/${language.id}/${id}/translate`}>
                                <Badge variant={done ? "success" : "outline"} className="gap-1.5">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={image(language.image)} alt="" className="size-3 rounded-sm object-cover" />
                                  {done ? "Đã dịch" : "Chưa dịch"}
                                </Badge>
                              </Link>
                            );
                          })}
                        </div>
                      </TableCell>
                    )}
                    <TableCell className="text-center">
                      <StatusSwitch model={model} id={id} value={widget.publish} />
                    </TableCell>
                    <TableCell>
                      <RowActions editHref={`/widget/${id}/edit`} deleteHref={`/widget/${id}/delete`} />
                    </TableCell>
                  </SelectableRow>
                );
              })}
            </TableBody>
          </Table>
        </SelectableTable>
        <AdminPagination paginator={makePaginator(total, perPage, page, "/widget/index", sp)} />
      </ListCard>
    </>
  );
}
