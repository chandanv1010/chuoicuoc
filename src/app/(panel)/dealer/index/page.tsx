import { CheckIcon, MapPinIcon, StarIcon } from "lucide-react";
import { CreateButton, ListCard, ListToolbar, PageHeader, RowActions } from "@/components/admin/page";
import { AdminPagination, makePaginator } from "@/components/admin/pagination";
import { AutoSubmitField, SelectableRow, SelectableTable, SelectAllCheckbox, SelectRowCheckbox, StatusSwitch } from "@/components/admin/fields";
import { Badge, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/misc";
import { __ } from "@/lib/lang";
import { param, type SearchParams } from "@/server/admin-list";
import { authorize } from "@/server/auth";
import { danhSachTinh, LOAI, paginateDealers, tenLoai } from "@/modules/dealer/dealer";

export const metadata = { title: "Điểm bán / đại lý" };

/** GET /dealer/index — DealerController@index (view backend/dealer/index.blade.php) */
export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await authorize("dealer.index");
  const sp = await searchParams;
  const [{ rows, total, perPage, page }, provinces] = await Promise.all([paginateDealers(sp), danhSachTinh()]);
  const seo = __<{ index: { title: string; table: string } }>("messages.dealer");
  const model = "Dealer";
  const provinceCode = param(sp, "province_code") ?? "";
  const type = param(sp, "type") ?? "";

  return (
    <>
      <PageHeader title={seo.index.title} crumbs={[{ label: seo.index.title }]} actions={<CreateButton href="/dealer/create" label="Thêm điểm bán" />} />
      <ListCard title={seo.index.table}>
        <ListToolbar action="/dealer/index" searchParams={sp}>
          <AutoSubmitField name="province_code" defaultValue={provinces.some((p) => p.code === provinceCode) ? provinceCode : ""} className="w-48">
            <option value="">Tất cả tỉnh/thành</option>
            {provinces.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name}
              </option>
            ))}
          </AutoSubmitField>
          <AutoSubmitField name="type" defaultValue={type in LOAI ? type : ""} className="w-44">
            <option value="">Tất cả loại</option>
            {Object.entries(LOAI).map(([ma, ten]) => (
              <option key={ma} value={ma}>
                {ten}
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
                <TableHead>Tên điểm bán</TableHead>
                <TableHead>Tỉnh/Thành</TableHead>
                <TableHead>Điện thoại</TableHead>
                <TableHead>Loại</TableHead>
                <TableHead className="w-20 text-center">Tọa độ</TableHead>
                <TableHead className="w-28 text-center">Tình trạng</TableHead>
                <TableHead className="w-24 text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-sm text-muted-foreground">
                    Chưa có điểm bán nào. Bấm <b>Thêm điểm bán</b> để nhập điểm đầu tiên.
                  </td>
                </tr>
              )}
              {rows.map((d) => {
                const id = d.id.toString();
                return (
                  <SelectableRow key={id} id={id}>
                    <TableCell>
                      <SelectRowCheckbox id={id} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 font-medium">
                        {d.name}
                        {d.is_featured ? (
                          <Badge variant="warning">
                            <StarIcon /> Nổi bật
                          </Badge>
                        ) : null}
                      </div>
                      {d.address && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPinIcon className="size-3 shrink-0" /> {d.address}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{d.province_name ?? "—"}</TableCell>
                    <TableCell className="text-sm">{d.phone || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{tenLoai(d.type)}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {/* Ban goc: pagination khong select latitude/longitude nen cot nay luon "Chua co" (giu nguyen) */}
                      {d.latitude !== null && d.longitude !== null ? <CheckIcon className="mx-auto size-4 text-success" /> : <Badge variant="destructive">Chưa có</Badge>}
                    </TableCell>
                    <TableCell className="text-center">
                      <StatusSwitch model={model} id={id} value={d.publish} />
                    </TableCell>
                    <TableCell>
                      <RowActions editHref={`/dealer/${id}/edit`} deleteHref={`/dealer/${id}/delete`} />
                    </TableCell>
                  </SelectableRow>
                );
              })}
            </TableBody>
          </Table>
        </SelectableTable>
        <AdminPagination paginator={makePaginator(total, perPage, page, "/dealer/index", sp)} />
      </ListCard>
    </>
  );
}
