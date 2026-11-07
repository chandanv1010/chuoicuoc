import { CreateButton, EmptyRow, ListCard, ListToolbar, PageHeader, RowActions } from "@/components/admin/page";
import { AdminPagination, makePaginator } from "@/components/admin/pagination";
import { SelectableRow, SelectableTable, SelectAllCheckbox, SelectRowCheckbox, StatusSwitch } from "@/components/admin/fields";
import { Badge, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/misc";
import type { SearchParams } from "@/server/admin-list";
import { authorize } from "@/server/auth";
import { paginateCustomers } from "@/modules/customer/customer";
import { ExportExcel } from "@/modules/order/export-modal";

export const metadata = { title: "Khách hàng" };

/**
 * GET /customer/index — CustomerController@index (customer/customer/index.blade.php).
 * O loc "Nhom thanh vien" cua ban goc khong duoc service su dung (luon chon 0) -> bo khoi giao dien.
 */
export default async function CustomerIndex({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await authorize("customer.index");
  const sp = await searchParams;
  const { rows, total, perPage, page } = await paginateCustomers(sp);
  const model = "Customer";

  return (
    <>
      <PageHeader
        title="Quản lý khách hàng"
        crumbs={[{ label: "Khách hàng" }]}
        actions={
          <>
            <ExportExcel title="Dữ liệu khách hàng" model="Customer" />
            <CreateButton href="/customer/create" label="Thêm mới khách hàng" />
          </>
        }
      />
      <ListCard title="Danh sách khách hàng">
        <ListToolbar action="/customer/index" searchParams={sp} />
        <SelectableTable model={model} ids={rows.map((r) => r.id.toString())}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <SelectAllCheckbox />
                </TableHead>
                <TableHead>Họ tên</TableHead>
                <TableHead>Liên hệ</TableHead>
                <TableHead>Địa chỉ</TableHead>
                <TableHead>Nhóm khách hàng</TableHead>
                <TableHead>Nguồn</TableHead>
                <TableHead className="w-28 text-center">Tình trạng</TableHead>
                <TableHead className="w-24 text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && <EmptyRow colSpan={8} />}
              {rows.map((customer) => {
                const id = customer.id.toString();
                return (
                  <SelectableRow key={id} id={id}>
                    <TableCell>
                      <SelectRowCheckbox id={id} />
                    </TableCell>
                    <TableCell className="font-medium">{customer.name}</TableCell>
                    <TableCell>
                      <div className="truncate">{customer.email}</div>
                      <div className="text-xs text-muted-foreground">{customer.phone}</div>
                    </TableCell>
                    <TableCell className="max-w-xs truncate">{customer.address}</TableCell>
                    <TableCell>{customer.catalogue_name && <Badge variant="secondary">{customer.catalogue_name}</Badge>}</TableCell>
                    <TableCell>{customer.source_name && <Badge variant="outline">{customer.source_name}</Badge>}</TableCell>
                    <TableCell className="text-center">
                      <StatusSwitch model={model} id={id} value={customer.publish} />
                    </TableCell>
                    <TableCell>
                      <RowActions editHref={`/customer/${id}/edit`} deleteHref={`/customer/${id}/delete`} />
                    </TableCell>
                  </SelectableRow>
                );
              })}
            </TableBody>
          </Table>
        </SelectableTable>
        <AdminPagination paginator={makePaginator(total, perPage, page, "/customer/index", sp)} />
      </ListCard>
    </>
  );
}
