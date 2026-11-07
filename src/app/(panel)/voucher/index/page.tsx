import Link from "next/link";
import { PencilIcon, Trash2Icon } from "lucide-react";
import { CreateButton, EmptyRow, ListCard, ListToolbar, PageHeader } from "@/components/admin/page";
import { AdminPagination, makePaginator } from "@/components/admin/pagination";
import { Button } from "@/components/ui/button";
import { Badge, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/misc";
import { convertDateTime, now } from "@/lib/helpers";
import { formatMoney } from "@/lib/money";
import { __ } from "@/lib/lang";
import type { SearchParams } from "@/server/admin-list";
import { authorize } from "@/server/auth";
import { paginateVouchers } from "@/modules/voucher/voucher";

export const metadata = { title: "Voucher" };

/** GET /voucher/index — VoucherController@index (backend/voucher/index.blade.php + component/table) */
export default async function VoucherIndex({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await authorize("voucher.index");
  const sp = await searchParams;
  const { rows, total, perPage, page } = await paginateVouchers(sp);
  const seo = __<{ index: { title: string; table: string } }>("messages.voucher");
  const methods = __<Record<string, string>>("module.voucher");
  const current = now().getTime();

  return (
    <>
      <PageHeader title={seo.index.title} crumbs={[{ label: seo.index.title }]} actions={<CreateButton href="/voucher/create" label="Thêm mới voucher" />} />
      <ListCard title={seo.index.table}>
        {/* Bang vouchers khong co cot publish -> bo loc tinh trang khong co tac dung, an di */}
        <ListToolbar action="/voucher/index" searchParams={sp} publish={false} />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tên voucher</TableHead>
              <TableHead className="text-center">Chiết khấu</TableHead>
              <TableHead>Ngày bắt đầu</TableHead>
              <TableHead>Ngày kết thúc</TableHead>
              <TableHead className="text-right">Số lượng</TableHead>
              <TableHead className="w-24 text-right">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && <EmptyRow colSpan={6} />}
            {rows.map((voucher) => {
              const id = voucher.id.toString();
              const expired = voucher.end_date !== null && voucher.end_date.getTime() - current <= 0;
              // Ban goc: voucher da duoc dung (used_quantity != 0) thi khoa nut sua / xoa
              const locked = voucher.used_quantity !== 0;
              return (
                <TableRow key={id}>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-2 font-medium">
                      {voucher.name}
                      {expired && <Badge variant="destructive">Hết hạn</Badge>}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      Mã: <span className="font-mono text-foreground">{voucher.code}</span> · {methods[voucher.method] ?? ""}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    {/* renderDiscountVoucher() */}
                    <Badge variant="success">
                      {voucher.discount_type === "PERCENTAGE" ? `${String(Number(voucher.discount_value))}%` : formatMoney(voucher.discount_value)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm whitespace-nowrap">{convertDateTime(voucher.start_date, "H:i d/m/Y")}</TableCell>
                  <TableCell className="text-sm whitespace-nowrap">{convertDateTime(voucher.end_date, "H:i d/m/Y")}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {voucher.used_quantity}/{voucher.total_quantity}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      {locked ? (
                        <>
                          <Button variant="ghost" size="icon-sm" disabled aria-label="Sửa (voucher đã được sử dụng)">
                            <PencilIcon />
                          </Button>
                          <Button variant="ghost" size="icon-sm" disabled aria-label="Xóa (voucher đã được sử dụng)">
                            <Trash2Icon />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button asChild variant="ghost" size="icon-sm" aria-label="Sửa">
                            <Link href={`/voucher/${id}/edit`}>
                              <PencilIcon />
                            </Link>
                          </Button>
                          <Button asChild variant="ghost" size="icon-sm" aria-label="Xóa" className="text-destructive hover:bg-destructive/10 hover:text-destructive">
                            <Link href={`/voucher/${id}/delete`}>
                              <Trash2Icon />
                            </Link>
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <AdminPagination paginator={makePaginator(total, perPage, page, "/voucher/index", sp)} />
      </ListCard>
    </>
  );
}
