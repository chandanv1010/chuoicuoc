import { ListTreeIcon } from "lucide-react";
import Link from "next/link";
import { CreateButton, EmptyRow, ListCard, ListToolbar, PageHeader, RowActions } from "@/components/admin/page";
import { AdminPagination, makePaginator } from "@/components/admin/pagination";
import { SelectableRow, SelectableTable, SelectAllCheckbox, SelectRowCheckbox, StatusSwitch } from "@/components/admin/fields";
import { Button } from "@/components/ui/button";
import { Badge, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/misc";
import { __ } from "@/lib/lang";
import type { SearchParams } from "@/server/admin-list";
import { authorize } from "@/server/auth";
import { paginateMenuCatalogues } from "@/modules/menu/menu";

export const metadata = { title: "Quản lý menu" };

/** GET /menu/index — MenuController@index (view backend/menu/menu/index + component/filter, table) */
export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await authorize("menu.index");
  const sp = await searchParams;
  const { rows, total, perPage, page } = await paginateMenuCatalogues(sp);
  const seo = __<{ index: { title: string; table: string }; create: { title: string } }>("messages.menu");
  const model = "MenuCatalogue";

  return (
    <>
      <PageHeader title={seo.index.title} crumbs={[{ label: seo.index.title }]} actions={<CreateButton href="/menu/create" label={seo.create.title} />} />
      <ListCard title={seo.index.table} description="Mỗi dòng là một vị trí hiển thị menu trên website.">
        <ListToolbar action="/menu/index" searchParams={sp} />
        <SelectableTable model={model} ids={rows.map((r) => r.id.toString())}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <SelectAllCheckbox />
                </TableHead>
                <TableHead>Vị trí menu</TableHead>
                <TableHead>Từ khóa</TableHead>
                <TableHead className="w-28 text-center">Tình trạng</TableHead>
                <TableHead className="w-48 text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && <EmptyRow colSpan={5} />}
              {rows.map((row) => {
                const id = row.id.toString();
                return (
                  <SelectableRow key={id} id={id}>
                    <TableCell>
                      <SelectRowCheckbox id={id} />
                    </TableCell>
                    <TableCell>
                      <Link href={`/menu/${id}/edit`} className="font-medium hover:text-primary">
                        {row.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-mono">
                        {row.keyword}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <StatusSwitch model={model} id={id} value={row.publish} />
                    </TableCell>
                    <TableCell>
                      <RowActions deleteHref={`/menu/${id}/delete`}>
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/menu/${id}/edit`}>
                            <ListTreeIcon /> Quản lý menu
                          </Link>
                        </Button>
                      </RowActions>
                    </TableCell>
                  </SelectableRow>
                );
              })}
            </TableBody>
          </Table>
        </SelectableTable>
        <AdminPagination paginator={makePaginator(total, perPage, page, "/menu/index", sp)} />
      </ListCard>
    </>
  );
}
