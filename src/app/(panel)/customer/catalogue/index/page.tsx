import { CreateButton, EmptyRow, ListCard, ListToolbar, PageHeader, RowActions } from "@/components/admin/page";
import { AdminPagination, makePaginator } from "@/components/admin/pagination";
import { SelectableRow, SelectableTable, SelectAllCheckbox, SelectRowCheckbox, StatusSwitch } from "@/components/admin/fields";
import { Badge, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/misc";
import { __ } from "@/lib/lang";
import type { SearchParams } from "@/server/admin-list";
import { authorize } from "@/server/auth";
import { paginateCustomerCatalogues } from "@/modules/customer/customer";

export const metadata = { title: "Nhóm khách hàng" };

/** GET /customer/catalogue/index — CustomerCatalogueController@index */
export default async function CustomerCatalogueIndex({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await authorize("customer.catalogue.index");
  const sp = await searchParams;
  const { rows, total, perPage, page } = await paginateCustomerCatalogues(sp);
  const seo = __<{ index: { title: string; table: string }; create: { title: string } }>("messages.customerCatalogue");
  const model = "CustomerCatalogue";

  return (
    <>
      <PageHeader
        title={seo.index.title}
        crumbs={[{ label: seo.index.title }]}
        actions={<CreateButton href="/customer/catalogue/create" label={seo.create.title} />}
      />
      <ListCard title={seo.index.table}>
        <ListToolbar action="/customer/catalogue/index" searchParams={sp} />
        <SelectableTable model={model} ids={rows.map((r) => r.id.toString())}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <SelectAllCheckbox />
                </TableHead>
                <TableHead>Tên nhóm khách hàng</TableHead>
                <TableHead className="text-right">Điểm tích lũy (%)</TableHead>
                <TableHead className="text-center">Số khách hàng</TableHead>
                <TableHead>Mô tả</TableHead>
                <TableHead className="w-28 text-center">Tình trạng</TableHead>
                <TableHead className="w-24 text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && <EmptyRow colSpan={7} />}
              {rows.map((row) => {
                const id = row.id.toString();
                return (
                  <SelectableRow key={id} id={id}>
                    <TableCell>
                      <SelectRowCheckbox id={id} />
                    </TableCell>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell className="text-right tabular-nums">{String(row.point_percent)}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{Number(row.customers_count)} người</Badge>
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-muted-foreground">{row.description}</TableCell>
                    <TableCell className="text-center">
                      <StatusSwitch model={model} id={id} value={row.publish} />
                    </TableCell>
                    <TableCell>
                      <RowActions editHref={`/customer/catalogue/${id}/edit`} deleteHref={`/customer/catalogue/${id}/delete`} />
                    </TableCell>
                  </SelectableRow>
                );
              })}
            </TableBody>
          </Table>
        </SelectableTable>
        <AdminPagination paginator={makePaginator(total, perPage, page, "/customer/catalogue/index", sp)} />
      </ListCard>
    </>
  );
}
