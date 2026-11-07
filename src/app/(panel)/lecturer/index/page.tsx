import { CreateButton, EmptyRow, ListCard, ListToolbar, PageHeader, RowActions, Thumb } from "@/components/admin/page";
import { AdminPagination, makePaginator } from "@/components/admin/pagination";
import { SelectableRow, SelectableTable, SelectAllCheckbox, SelectRowCheckbox, StatusSwitch } from "@/components/admin/fields";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/misc";
import { stripTags, strLimit } from "@/lib/helpers";
import { __ } from "@/lib/lang";
import type { SearchParams } from "@/server/admin-list";
import { authorize } from "@/server/auth";
import { paginateLecturers } from "@/modules/lecturer/service";

export const metadata = { title: "Giảng viên" };

/** GET /lecturer/index — LecturerController@index (lecturer/index.blade.php) */
export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await authorize("lecturer.index");
  const sp = await searchParams;
  const { rows, total, perPage, page } = await paginateLecturers(sp);
  const model = "Lecturer";
  const title = __<string>("messages.lecturer.index.title");
  return (
    <>
      <PageHeader title={title} crumbs={[{ label: title }]} actions={<CreateButton href="/lecturer/create" label="Thêm mới giảng viên" />} />
      <ListCard title={__<string>("messages.lecturer.index.table")}>
        <ListToolbar action="/lecturer/index" searchParams={sp} />
        <SelectableTable model={model} ids={rows.map((r) => r.id.toString())}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <SelectAllCheckbox />
                </TableHead>
                <TableHead>Giảng viên</TableHead>
                <TableHead>Chức vụ</TableHead>
                <TableHead>Mô tả</TableHead>
                <TableHead className="w-28 text-center">Tình trạng</TableHead>
                <TableHead className="w-24 text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && <EmptyRow colSpan={6} />}
              {rows.map((row) => {
                const id = row.id.toString();
                return (
                  <SelectableRow key={id} id={id}>
                    <TableCell>
                      <SelectRowCheckbox id={id} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Thumb src={row.image} className="size-10 rounded-full" />
                        <span className="font-medium">{row.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>{row.position}</TableCell>
                    <TableCell className="max-w-80 text-xs text-muted-foreground">{strLimit(stripTags(row.description), 140)}</TableCell>
                    <TableCell className="text-center">
                      <StatusSwitch model={model} id={id} value={row.publish} />
                    </TableCell>
                    <TableCell>
                      <RowActions editHref={`/lecturer/${id}/edit`} deleteHref={`/lecturer/${id}/delete`} />
                    </TableCell>
                  </SelectableRow>
                );
              })}
            </TableBody>
          </Table>
        </SelectableTable>
        <AdminPagination paginator={makePaginator(total, perPage, page, "/lecturer/index", sp)} />
      </ListCard>
    </>
  );
}
