import { StarIcon } from "lucide-react";
import { EmptyRow, ListCard, ListToolbar, PageHeader, RowActions } from "@/components/admin/page";
import { AdminPagination, makePaginator } from "@/components/admin/pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/misc";
import { __ } from "@/lib/lang";
import { convertDateTime, writeUrl } from "@/lib/helpers";
import type { SearchParams } from "@/server/admin-list";
import { authorize } from "@/server/auth";
import { paginateReviews } from "@/modules/review/review";
import { ReviewStatus } from "@/modules/review/review-status";

export const metadata = { title: "Đánh giá" };

/**
 * GET /review/index — ReviewController@index (review/index.blade.php).
 * Bang reviews khong co cot publish nen khong co thao tac xuat ban hang loat.
 */
export default async function ReviewIndex({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await authorize("review.index");
  const sp = await searchParams;
  const { rows, total, perPage, page } = await paginateReviews(sp);
  const seo = __<{ index: { title: string; table: string } }>("messages.review");
  const statuses = __<string[] | Record<string, string>>("messages.status");
  const options = Object.entries(statuses).map(([k, v]) => [k, String(v)] as [string, string]);

  return (
    <>
      <PageHeader title={seo.index.title} crumbs={[{ label: seo.index.title }]} />
      <ListCard title={seo.index.table}>
        <ListToolbar action="/review/index" searchParams={sp} publish={false} />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Khách hàng</TableHead>
              <TableHead className="min-w-64">Nội dung</TableHead>
              <TableHead>Ảnh</TableHead>
              <TableHead className="text-center">Điểm</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead className="w-16 text-right">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && <EmptyRow colSpan={6} text="Chưa có đánh giá nào." />}
            {rows.map((review) => {
              const id = review.id.toString();
              return (
                <TableRow key={id}>
                  <TableCell>
                    <div className="font-medium">{review.fullname}</div>
                    <div className="text-xs text-muted-foreground">{review.phone}</div>
                    <div className="text-xs text-muted-foreground">{review.email}</div>
                    <div className="text-xs text-muted-foreground">{convertDateTime(review.created_at, "d/m/Y H:i")}</div>
                  </TableCell>
                  <TableCell className="text-sm whitespace-normal">{review.description}</TableCell>
                  <TableCell>
                    {review.image ? (
                      <a href={`/${review.image}`} target="_blank" rel="noreferrer" className="block size-16 overflow-hidden rounded-md border bg-muted">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={`/${review.image}`} alt="" className="size-full object-cover" loading="lazy" />
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="inline-flex items-center gap-1 font-medium text-amber-600">
                      {review.score} <StarIcon className="size-3.5 fill-current" />
                    </span>
                  </TableCell>
                  <TableCell>
                    <ReviewStatus id={id} status={review.status} options={options} href={writeUrl(review.canonical)} />
                  </TableCell>
                  <TableCell>
                    <RowActions deleteHref={`/review/${id}/delete`} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <AdminPagination paginator={makePaginator(total, perPage, page, "/review/index", sp)} />
      </ListCard>
    </>
  );
}
