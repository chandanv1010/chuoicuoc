import { CheckIcon, RepeatIcon } from "lucide-react";
import { CreateButton, EmptyRow, ListCard, ListToolbar, PageHeader, RowActions, Thumb } from "@/components/admin/page";
import { AdminPagination, makePaginator } from "@/components/admin/pagination";
import { SelectableRow, SelectableTable, SelectAllCheckbox, SelectRowCheckbox, StatusSwitch } from "@/components/admin/fields";
import { Button } from "@/components/ui/button";
import { Badge, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/misc";
import { getCurrentLanguage } from "@/lib/language";
import type { SearchParams } from "@/server/admin-list";
import { authorize } from "@/server/auth";
import { paginateLanguages } from "@/modules/language/service";

export const metadata = { title: "Quản lý ngôn ngữ" };

/**
 * GET /language/index — LanguageController@index (language/index.blade.php).
 * Them cot "Ngon ngu quan tri": nut doi sang ngon ngu do qua GET /language/{id}/switch
 * (giong menu co tren thanh dieu huong).
 */
export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await authorize("language.index");
  const sp = await searchParams;
  const [{ rows, total, perPage, page }, current] = await Promise.all([paginateLanguages(sp), getCurrentLanguage()]);
  const model = "Language";
  return (
    <>
      <PageHeader title="Quản lý ngôn ngữ" crumbs={[{ label: "Ngôn ngữ" }]} actions={<CreateButton href="/language/create" label="Thêm mới ngôn ngữ" />} />
      <ListCard title="Danh sách ngôn ngữ">
        <ListToolbar action="/language/index" searchParams={sp} />
        <SelectableTable model={model} ids={rows.map((r) => r.id.toString())}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <SelectAllCheckbox />
                </TableHead>
                <TableHead>Tên ngôn ngữ</TableHead>
                <TableHead>Canonical</TableHead>
                <TableHead className="w-44 text-center">Ngôn ngữ quản trị</TableHead>
                <TableHead className="w-28 text-center">Tình trạng</TableHead>
                <TableHead className="w-24 text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && <EmptyRow colSpan={6} />}
              {rows.map((row) => {
                const id = row.id.toString();
                const active = row.id === current.id;
                return (
                  <SelectableRow key={id} id={id}>
                    <TableCell>
                      <SelectRowCheckbox id={id} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Thumb src={row.image} className="h-7 w-10" />
                        <span className="font-medium">{row.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{row.canonical}</code>
                    </TableCell>
                    <TableCell className="text-center">
                      {active ? (
                        <Badge variant="success">
                          <CheckIcon /> Đang dùng
                        </Badge>
                      ) : (
                        <Button asChild size="sm" variant="outline">
                          {/* route handler (redirect) -> dung <a> thuong */}
                          <a href={`/language/${id}/switch`}>
                            <RepeatIcon /> Chuyển sang
                          </a>
                        </Button>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <StatusSwitch model={model} id={id} value={row.publish} />
                    </TableCell>
                    <TableCell>
                      <RowActions editHref={`/language/${id}/edit`} deleteHref={`/language/${id}/delete`} />
                    </TableCell>
                  </SelectableRow>
                );
              })}
            </TableBody>
          </Table>
        </SelectableTable>
        <AdminPagination paginator={makePaginator(total, perPage, page, "/language/index", sp)} />
      </ListCard>
    </>
  );
}
