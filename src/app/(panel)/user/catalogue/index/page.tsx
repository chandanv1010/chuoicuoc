import { KeyRoundIcon } from "lucide-react";
import Link from "next/link";
import { CreateButton, EmptyRow, ListCard, ListToolbar, PageHeader, RowActions } from "@/components/admin/page";
import { AdminPagination, makePaginator } from "@/components/admin/pagination";
import { SelectableRow, SelectableTable, SelectAllCheckbox, SelectRowCheckbox, StatusSwitch } from "@/components/admin/fields";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/misc";
import type { SearchParams } from "@/server/admin-list";
import { authorize } from "@/server/auth";
import { paginateUserCatalogues } from "@/modules/user/service";

export const metadata = { title: "Quản lý nhóm thành viên" };

/** GET /user/catalogue/index — UserCatalogueController@index (user/catalogue/index.blade.php) */
export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await authorize("user.catalogue.index");
  const sp = await searchParams;
  const { rows, total, perPage, page } = await paginateUserCatalogues(sp);
  const model = "UserCatalogue";
  return (
    <>
      <PageHeader
        title="Quản lý nhóm thành viên"
        crumbs={[{ label: "Nhóm thành viên" }]}
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/user/catalogue/permission">
                <KeyRoundIcon /> Phân quyền
              </Link>
            </Button>
            <CreateButton href="/user/catalogue/create" label="Thêm mới nhóm" />
          </>
        }
      />
      <ListCard title="Danh sách nhóm thành viên">
        <ListToolbar action="/user/catalogue/index" searchParams={sp} />
        <SelectableTable model={model} ids={rows.map((r) => r.id.toString())}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <SelectAllCheckbox />
                </TableHead>
                <TableHead>Tên nhóm thành viên</TableHead>
                <TableHead className="w-32 text-center">Số thành viên</TableHead>
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
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell className="text-center tabular-nums">{Number(row.users_count)} người</TableCell>
                    <TableCell className="text-muted-foreground">{row.description}</TableCell>
                    <TableCell className="text-center">
                      <StatusSwitch model={model} id={id} value={row.publish} />
                    </TableCell>
                    <TableCell>
                      <RowActions editHref={`/user/catalogue/${id}/edit`} deleteHref={`/user/catalogue/${id}/delete`} />
                    </TableCell>
                  </SelectableRow>
                );
              })}
            </TableBody>
          </Table>
        </SelectableTable>
        <AdminPagination paginator={makePaginator(total, perPage, page, "/user/catalogue/index", sp)} />
      </ListCard>
    </>
  );
}
