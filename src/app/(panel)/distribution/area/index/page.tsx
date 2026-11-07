import { CreateButton, EmptyRow, ListCard, ListToolbar, PageHeader, RowActions } from "@/components/admin/page";
import { AdminPagination, makePaginator } from "@/components/admin/pagination";
import { SelectableRow, SelectableTable, SelectAllCheckbox, SelectRowCheckbox, StatusSwitch } from "@/components/admin/fields";
import { Badge, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/misc";
import { __ } from "@/lib/lang";
import type { SearchParams } from "@/server/admin-list";
import { authorize } from "@/server/auth";
import { paginateAreas } from "@/modules/distribution/distribution";

export const metadata = { title: "Khu vực phân phối" };

/** GET /distribution/area/index — DistributionAreaController@index */
export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await authorize("distribution.area.index");
  const sp = await searchParams;
  const { rows, total, perPage, page } = await paginateAreas(sp);
  const seo = __<{ index: { title: string; table: string }; create: { title: string } }>("messages.distributionArea");
  const model = "DistributionArea";

  return (
    <>
      <PageHeader title={seo.index.title} crumbs={[{ label: seo.index.title }]} actions={<CreateButton href="/distribution/area/create" label={seo.create.title} />} />
      <ListCard title={seo.index.table}>
        <ListToolbar action="/distribution/area/index" searchParams={sp} />
        <SelectableTable model={model} ids={rows.map((r) => r.id.toString())}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <SelectAllCheckbox />
                </TableHead>
                <TableHead>Tên khu vực</TableHead>
                <TableHead>Thuộc khu vực cha</TableHead>
                <TableHead className="w-28 text-center">Tình trạng</TableHead>
                <TableHead className="w-24 text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && <EmptyRow colSpan={5} />}
              {rows.map((area) => {
                const id = area.id.toString();
                return (
                  <SelectableRow key={id} id={id}>
                    <TableCell>
                      <SelectRowCheckbox id={id} />
                    </TableCell>
                    <TableCell className="font-medium">{area.name}</TableCell>
                    <TableCell>{area.parent_name ?? <Badge variant="secondary">Cấp cha (Miền)</Badge>}</TableCell>
                    <TableCell className="text-center">
                      <StatusSwitch model={model} id={id} value={area.publish} />
                    </TableCell>
                    <TableCell>
                      <RowActions editHref={`/distribution/area/${id}/edit`} deleteHref={`/distribution/area/${id}/delete`} />
                    </TableCell>
                  </SelectableRow>
                );
              })}
            </TableBody>
          </Table>
        </SelectableTable>
        <AdminPagination paginator={makePaginator(total, perPage, page, "/distribution/area/index", sp)} />
      </ListCard>
    </>
  );
}
