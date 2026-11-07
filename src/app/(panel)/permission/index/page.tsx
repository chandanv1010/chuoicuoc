import { KeyRoundIcon } from "lucide-react";
import Link from "next/link";
import { CreateButton, EmptyRow, ListCard, ListToolbar, PageHeader, RowActions } from "@/components/admin/page";
import { AdminPagination, makePaginator } from "@/components/admin/pagination";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/misc";
import type { SearchParams } from "@/server/admin-list";
import { authorize } from "@/server/auth";
import { paginatePermissions } from "@/modules/user/service";

export const metadata = { title: "Quản lý quyền" };

/**
 * GET /permission/index — PermissionController@index (permission/index.blade.php).
 * Bang permissions khong co cot publish nen bo bo loc tinh trang va cot chon nhieu dong.
 */
export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await authorize("permission.index");
  const sp = await searchParams;
  const { rows, total, perPage, page } = await paginatePermissions(sp);
  return (
    <>
      <PageHeader
        title="Quản lý quyền"
        crumbs={[{ label: "Quyền" }]}
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/user/catalogue/permission">
                <KeyRoundIcon /> Phân quyền
              </Link>
            </Button>
            <CreateButton href="/permission/create" label="Thêm mới quyền" />
          </>
        }
      />
      <ListCard title="Danh sách quyền">
        <ListToolbar action="/permission/index" searchParams={sp} publish={false} />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tiêu đề</TableHead>
              <TableHead>Canonical</TableHead>
              <TableHead className="w-24 text-right">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && <EmptyRow colSpan={3} />}
            {rows.map((p) => (
              <TableRow key={p.id.toString()}>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell>
                  <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{p.canonical}</code>
                </TableCell>
                <TableCell>
                  <RowActions editHref={`/permission/${p.id}/edit`} deleteHref={`/permission/${p.id}/delete`} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <AdminPagination paginator={makePaginator(total, perPage, page, "/permission/index", sp)} />
      </ListCard>
    </>
  );
}
