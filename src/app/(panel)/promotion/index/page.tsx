import Link from "next/link";
import { SelectableRow, SelectableTable, SelectAllCheckbox, SelectRowCheckbox, StatusSwitch } from "@/components/admin/fields";
import { CreateButton, EmptyRow, ListCard, ListToolbar, PageHeader, RowActions } from "@/components/admin/page";
import { AdminPagination, makePaginator } from "@/components/admin/pagination";
import { Badge, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/misc";
import { convertDateTime, now } from "@/lib/helpers";
import { formatMoney } from "@/lib/money";
import { __ } from "@/lib/lang";
import type { SearchParams } from "@/server/admin-list";
import { authorize } from "@/server/auth";
import { paginatePromotions, PromotionEnum, type Promotion } from "@/modules/promotion/promotion";

export const metadata = { title: "Khuyến mại" };

/** renderDiscountInformation($promotion) — MyHelper.php */
function DiscountInformation({ promotion }: { promotion: Promotion }) {
  if (promotion.method === PromotionEnum.PRODUCT_AND_QUANTITY) {
    const info = (promotion.discountInformation?.info ?? {}) as Record<string, unknown>;
    return (
      <Badge variant="success">
        {info.discountType === "percent" ? `${String(info.discountValue ?? "")}%` : formatMoney(info.discountValue)}
      </Badge>
    );
  }
  return (
    <Link href={`/promotion/${promotion.id}/edit`} className="text-sm text-primary hover:underline">
      Xem chi tiết
    </Link>
  );
}

/** GET /promotion/index — PromotionController@index (promotion/promotion/index.blade.php) */
export default async function PromotionIndex({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await authorize("promotion.index");
  const sp = await searchParams;
  const { rows, total, perPage, page } = await paginatePromotions(sp);
  const seo = __<{ index: { title: string; table: string } }>("messages.promotion");
  const methods: Record<string, string> = { ...__<Record<string, string>>("module.promotion"), buy_combo: "Mua theo combo" };
  const model = "Promotion";
  const current = now().getTime();
  const ids = rows.map((r) => r.id.toString());

  return (
    <>
      <PageHeader title={seo.index.title} crumbs={[{ label: seo.index.title }]} actions={<CreateButton href="/promotion/create" label="Thêm mới khuyến mại" />} />
      <ListCard title={seo.index.table}>
        <ListToolbar action="/promotion/index" searchParams={sp} />
        <SelectableTable model={model} ids={ids}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <SelectAllCheckbox />
                </TableHead>
                <TableHead>Tên chương trình</TableHead>
                <TableHead className="text-center">Chiết khấu</TableHead>
                <TableHead>Hình thức</TableHead>
                <TableHead>Ngày bắt đầu</TableHead>
                <TableHead>Ngày kết thúc</TableHead>
                <TableHead className="w-24 text-center">Tình trạng</TableHead>
                <TableHead className="w-24 text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && <EmptyRow colSpan={8} />}
              {rows.map((promotion) => {
                const id = promotion.id.toString();
                const expired = promotion.endDate !== null && promotion.endDate.getTime() - current <= 0;
                return (
                  <SelectableRow key={id} id={id}>
                    <TableCell>
                      <SelectRowCheckbox id={id} />
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-2 font-medium">
                        {promotion.name}
                        {expired && <Badge variant="destructive">Hết hạn</Badge>}
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        Mã: <span className="font-mono text-foreground">{promotion.code}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <DiscountInformation promotion={promotion} />
                    </TableCell>
                    <TableCell className="text-sm">{methods[promotion.method] ?? ""}</TableCell>
                    <TableCell className="text-sm whitespace-nowrap">{convertDateTime(promotion.startDate)}</TableCell>
                    <TableCell className="text-sm whitespace-nowrap">
                      {/* Blade goc goi convertDateTime(null) -> loi 500 khi endDate null; o day hien "Khong gioi han" */}
                      {promotion.neverEndDate === "accept" ? <span className="text-muted-foreground">Không giới hạn</span> : convertDateTime(promotion.endDate)}
                    </TableCell>
                    <TableCell className="text-center">
                      <StatusSwitch model={model} id={id} value={promotion.publish} />
                    </TableCell>
                    <TableCell>
                      <RowActions editHref={`/promotion/${id}/edit`} deleteHref={`/promotion/${id}/delete`} />
                    </TableCell>
                  </SelectableRow>
                );
              })}
            </TableBody>
          </Table>
        </SelectableTable>
        <AdminPagination paginator={makePaginator(total, perPage, page, "/promotion/index", sp)} />
      </ListCard>
    </>
  );
}
