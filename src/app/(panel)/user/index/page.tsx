import { CreateButton, EmptyRow, ListCard, ListToolbar, PageHeader, RowActions } from "@/components/admin/page";
import { AdminPagination, makePaginator } from "@/components/admin/pagination";
import { SelectableRow, SelectableTable, SelectAllCheckbox, SelectRowCheckbox, StatusSwitch } from "@/components/admin/fields";
import { Badge, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/misc";
import type { SearchParams } from "@/server/admin-list";
import { authorize } from "@/server/auth";
import { LockIcon } from "lucide-react";
import { isRootEmail } from "@/modules/system/site-type";
import { paginateUsers } from "@/modules/user/service";

export const metadata = { title: "Quản lý thành viên" };

/** GET /user/index — UserController@index (user/user/index.blade.php) */
export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const admin = await authorize("user.index");
  const viewerIsRoot = isRootEmail(admin.email);
  const sp = await searchParams;
  const { rows, total, perPage, page } = await paginateUsers(sp);
  const model = "User";
  return (
    <>
      <PageHeader title="Quản lý thành viên" crumbs={[{ label: "Thành viên" }]} actions={<CreateButton href="/user/create" label="Thêm mới thành viên" />} />
      <ListCard title="Danh sách thành viên">
        {/* Blade goc co them select "Nhom thanh vien" nhung khong dung de loc -> bo */}
        <ListToolbar action="/user/index" searchParams={sp} />
        <SelectableTable model={model} ids={rows.map((r) => r.id.toString())}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <SelectAllCheckbox />
                </TableHead>
                <TableHead>Họ tên</TableHead>
                <TableHead>Số điện thoại</TableHead>
                <TableHead>Địa chỉ</TableHead>
                <TableHead>Nhóm thành viên</TableHead>
                <TableHead className="w-28 text-center">Tình trạng</TableHead>
                <TableHead className="w-24 text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && <EmptyRow colSpan={7} />}
              {rows.map((user) => {
                const id = user.id.toString();
                // Tai khoan goc: khoa cung voi nguoi khac (khong sua / khoa / xoa)
                const locked = isRootEmail(user.email) && !viewerIsRoot;
                return (
                  <SelectableRow key={id} id={id}>
                    <TableCell>
                      {!locked && <SelectRowCheckbox id={id} />}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 font-medium">
                        {user.name}
                        {isRootEmail(user.email) && (
                          <Badge variant="secondary" className="gap-1">
                            <LockIcon className="size-3" /> Tài khoản gốc
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">{user.email}</div>
                    </TableCell>
                    <TableCell>{user.phone}</TableCell>
                    <TableCell className="max-w-64 truncate">{user.address}</TableCell>
                    <TableCell>{user.catalogue_name && <Badge variant="secondary">{user.catalogue_name}</Badge>}</TableCell>
                    <TableCell className="text-center">
                      {locked ? <span className="text-xs text-muted-foreground">Khóa</span> : <StatusSwitch model={model} id={id} value={user.publish} />}
                    </TableCell>
                    <TableCell>
                      {!locked && <RowActions editHref={`/user/${id}/edit`} deleteHref={`/user/${id}/delete`} />}
                    </TableCell>
                  </SelectableRow>
                );
              })}
            </TableBody>
          </Table>
        </SelectableTable>
        <AdminPagination paginator={makePaginator(total, perPage, page, "/user/index", sp)} />
      </ListCard>
    </>
  );
}
