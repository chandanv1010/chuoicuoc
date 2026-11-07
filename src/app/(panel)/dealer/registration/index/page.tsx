import Link from "next/link";
import { ListCard, ListToolbar, PageHeader, RowActions } from "@/components/admin/page";
import { AdminPagination, makePaginator } from "@/components/admin/pagination";
import { AutoSubmitField } from "@/components/admin/fields";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/misc";
import { strLimit } from "@/lib/helpers";
import { __ } from "@/lib/lang";
import { cn } from "@/lib/utils";
import { param, type SearchParams } from "@/server/admin-list";
import { authorize } from "@/server/auth";
import { demTheoTrangThai, formatHiDmy, paginateRegistrations, TRANG_THAI } from "@/modules/dealer/dealer";
import { StatusBadge } from "@/modules/dealer/status-badge";

export const metadata = { title: "Đơn đăng ký đại lý" };

/** GET /dealer/registration/index — DealerRegistrationController@index (view backend/dealer_registration/index.blade.php) */
export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await authorize("dealer.registration.index");
  const sp = await searchParams;
  const [{ rows, total, perPage, page }, dem] = await Promise.all([paginateRegistrations(sp), demTheoTrangThai()]);
  const seo = __<{ index: { title: string; table: string } }>("messages.dealerRegistration");
  const dangLoc = param(sp, "status");
  const tong = Object.values(dem).reduce((a, b) => a + b, 0);
  const tabs: [string, string, number][] = [...Object.entries(TRANG_THAI).map(([ma, ten]) => [ma, ten, dem[ma] ?? 0] as [string, string, number]), ["", "Tất cả", tong]];

  return (
    <>
      <PageHeader title={seo.index.title} crumbs={[{ label: seo.index.title }]} description="Đơn khách tự gửi từ form “Đăng ký làm đại lý” ngoài website." />
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {tabs.map(([ma, ten, so]) => {
          const active = ma ? dangLoc === ma : !dangLoc;
          return (
            <Link
              key={ma || "all"}
              href={ma ? `/dealer/registration/index?status=${ma}` : "/dealer/registration/index"}
              className={cn("rounded-lg border bg-card p-3 text-sm transition-colors hover:border-primary", active && "border-primary ring-2 ring-primary/20")}
            >
              <div className="text-muted-foreground">{ten}</div>
              <div className="mt-1 text-lg font-semibold">
                {so} <span className="text-sm font-normal text-muted-foreground">đơn</span>
              </div>
            </Link>
          );
        })}
      </div>
      <ListCard title={seo.index.table}>
        <ListToolbar action="/dealer/registration/index" searchParams={sp} publish={false}>
          <AutoSubmitField name="status" defaultValue={dangLoc && dangLoc in TRANG_THAI ? dangLoc : ""} className="w-44">
            <option value="">Tất cả trạng thái</option>
            {Object.entries(TRANG_THAI).map(([ma, ten]) => (
              <option key={ma} value={ma}>
                {ten}
              </option>
            ))}
          </AutoSubmitField>
        </ListToolbar>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-14 text-center">#</TableHead>
              <TableHead>Khách hàng</TableHead>
              <TableHead>Công ty / Khu vực</TableHead>
              <TableHead>Ghi chú</TableHead>
              <TableHead className="w-32 text-center">Trạng thái</TableHead>
              <TableHead className="w-32">Ngày gửi</TableHead>
              <TableHead className="w-24 text-right">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="py-12 text-center text-sm text-muted-foreground">
                  Chưa có đơn đăng ký nào.
                </td>
              </tr>
            )}
            {rows.map((r) => {
              const id = r.id.toString();
              return (
                <TableRow key={id}>
                  <TableCell className="text-center text-muted-foreground">{id}</TableCell>
                  <TableCell>
                    <Link href={`/dealer/registration/${id}/edit`} className="font-medium hover:text-primary">
                      {r.name}
                    </Link>
                    <div>
                      <a href={`tel:${r.phone}`} className="text-xs text-muted-foreground hover:text-primary">
                        {r.phone}
                      </a>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {r.company || "—"}
                    {r.business_area && <div className="text-xs text-muted-foreground">{r.business_area}</div>}
                  </TableCell>
                  <TableCell className="max-w-72 text-xs text-muted-foreground">{strLimit(r.note, 120)}</TableCell>
                  <TableCell className="text-center">
                    <StatusBadge status={r.status} />
                  </TableCell>
                  <TableCell className="text-xs whitespace-nowrap">{formatHiDmy(r.created_at)}</TableCell>
                  <TableCell>
                    <RowActions editHref={`/dealer/registration/${id}/edit`} deleteHref={`/dealer/registration/${id}/delete`} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <AdminPagination paginator={makePaginator(total, perPage, page, "/dealer/registration/index", sp)} />
      </ListCard>
    </>
  );
}
