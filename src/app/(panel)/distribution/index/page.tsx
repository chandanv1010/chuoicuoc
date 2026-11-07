import { MailIcon, MapPinIcon, PhoneIcon } from "lucide-react";
import { CreateButton, EmptyRow, ListCard, ListToolbar, PageHeader, RowActions, Thumb } from "@/components/admin/page";
import { AdminPagination, makePaginator } from "@/components/admin/pagination";
import { AutoSubmitField, SelectableRow, SelectableTable, SelectAllCheckbox, SelectRowCheckbox, StatusSwitch } from "@/components/admin/fields";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/misc";
import { __ } from "@/lib/lang";
import { param, type SearchParams } from "@/server/admin-list";
import { authorize } from "@/server/auth";
import { findAreaByParentId, paginateDistributions } from "@/modules/distribution/distribution";

export const metadata = { title: "Nhà phân phối" };

/** GET /distribution/index — DistributionController@index (view backend/distribution/index.blade.php) */
export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await authorize("distribution.index");
  const sp = await searchParams;
  const [{ rows, total, perPage, page }, regions] = await Promise.all([paginateDistributions(sp), findAreaByParentId(0)]);
  const seo = __<{ index: { title: string; table: string }; create: { title: string } }>("messages.distribution");
  const model = "Distribution";
  const provinceId = param(sp, "province_id") ?? "0";

  return (
    <>
      <PageHeader title={seo.index.title} crumbs={[{ label: seo.index.title }]} actions={<CreateButton href="/distribution/create" label={seo.create.title} />} />
      <ListCard title={seo.index.table}>
        <ListToolbar action="/distribution/index" searchParams={sp}>
          <AutoSubmitField name="province_id" defaultValue={regions.some((r) => r.id.toString() === provinceId) ? provinceId : "0"} className="w-52">
            <option value="0">Tất cả miền</option>
            {regions.map((r) => (
              <option key={r.id.toString()} value={r.id.toString()}>
                {r.name}
              </option>
            ))}
          </AutoSubmitField>
        </ListToolbar>
        <SelectableTable model={model} ids={rows.map((r) => r.id.toString())}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <SelectAllCheckbox />
                </TableHead>
                <TableHead>Nhà phân phối</TableHead>
                <TableHead>Liên hệ</TableHead>
                <TableHead>Khu vực</TableHead>
                <TableHead className="w-28 text-center">Tình trạng</TableHead>
                <TableHead className="w-24 text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && <EmptyRow colSpan={6} />}
              {rows.map((d) => {
                const id = d.id.toString();
                return (
                  <SelectableRow key={id} id={id}>
                    <TableCell>
                      <SelectRowCheckbox id={id} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Thumb src={d.image || "/backend/img/image.svg"} className="size-10" />
                        <div className="min-w-0">
                          <div className="truncate font-medium">{d.name}</div>
                          {d.address && (
                            <div className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                              <MapPinIcon className="size-3 shrink-0" /> {d.address}
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {d.phone && (
                        <div className="flex items-center gap-1">
                          <PhoneIcon className="size-3 text-muted-foreground" /> {d.phone}
                        </div>
                      )}
                      {d.email && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MailIcon className="size-3" /> {d.email}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      <div>{d.area_name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{d.region_name ?? ""}</div>
                    </TableCell>
                    <TableCell className="text-center">
                      <StatusSwitch model={model} id={id} value={d.publish} />
                    </TableCell>
                    <TableCell>
                      <RowActions editHref={`/distribution/${id}/edit`} deleteHref={`/distribution/${id}/delete`} />
                    </TableCell>
                  </SelectableRow>
                );
              })}
            </TableBody>
          </Table>
        </SelectableTable>
        <AdminPagination paginator={makePaginator(total, perPage, page, "/distribution/index", sp)} />
      </ListCard>
    </>
  );
}
