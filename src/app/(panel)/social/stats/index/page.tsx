import { RefreshCwIcon } from "lucide-react";
import Link from "next/link";
import { ListCard, PageHeader, Thumb } from "@/components/admin/page";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/misc";
import { convertDateTime } from "@/lib/helpers";
import { cn } from "@/lib/utils";
import { param, type SearchParams } from "@/server/admin-list";
import { authorize } from "@/server/auth";
import { productStats } from "@/modules/social/stats";

export const metadata = { title: "Thống kê tương tác" };

const n = (v: unknown) => Number(v ?? 0);

/**
 * GET /social/stats/index — tuong tac theo san pham (tong cac bai da dang Facebook / Instagram) + so khach can tu van.
 * So lieu lam moi 30 phut / lan cung vong dong bo hop thu, hoac bam "Cap nhat ngay".
 */
export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await authorize("social.stats.index");
  const sp = await searchParams;
  const sort = param(sp, "sort") ?? "engagement";
  const rows = await productStats(sort);
  const last = rows.reduce<Date | null>((a, r) => (r.last_stats && (!a || r.last_stats > a) ? r.last_stats : a), null);
  const total = rows.reduce(
    (a, r) => ({ likes: a.likes + n(r.fb_likes) + n(r.ig_likes), comments: a.comments + n(r.fb_comments) + n(r.ig_comments), shares: a.shares + n(r.fb_shares), leads: a.leads + n(r.leads) }),
    { likes: 0, comments: 0, shares: 0, leads: 0 },
  );
  const sorts: [string, string][] = [
    ["engagement", "Tương tác"],
    ["leads", "Khách cần tư vấn"],
    ["posts", "Số bài đăng"],
  ];

  return (
    <>
      <PageHeader
        title="Thống kê tương tác"
        crumbs={[{ label: "Mạng xã hội" }, { label: "Thống kê tương tác" }]}
        description={
          <>
            Tổng lượt thích, bình luận, chia sẻ của các bài đã đăng theo từng sản phẩm{last ? `, cập nhật ${convertDateTime(last, "H:i d/m")}` : ""}. Pinterest và
            TikTok chỉ đếm số bài (Pinterest cần Standard access mới có số liệu).
          </>
        }
        actions={
          <form action="/social/stats/refresh" method="post">
            <Button type="submit">
              <RefreshCwIcon /> Cập nhật ngay
            </Button>
          </form>
        }
      />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Lượt thích", total.likes],
          ["Bình luận", total.comments],
          ["Chia sẻ", total.shares],
          ["Khách cần tư vấn", total.leads],
        ].map(([label, v]) => (
          <div key={label} className="rounded-lg border bg-card p-3 text-sm">
            <div className="text-muted-foreground">{label}</div>
            <div className="mt-1 text-lg font-semibold">{v}</div>
          </div>
        ))}
      </div>
      <ListCard title="Theo sản phẩm">
        <div className="flex flex-wrap gap-2 pb-4 text-sm">
          <span className="self-center text-muted-foreground">Sắp xếp:</span>
          {sorts.map(([k, label]) => (
            <Link key={k} href={`/social/stats/index?sort=${k}`} className={cn("rounded-md border px-3 py-1", sort === k ? "border-primary bg-primary/5 font-medium" : "hover:border-primary")}>
              {label}
            </Link>
          ))}
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sản phẩm</TableHead>
                <TableHead className="text-right">Bài</TableHead>
                <TableHead className="text-right">FB thích</TableHead>
                <TableHead className="text-right">FB bình luận</TableHead>
                <TableHead className="text-right">FB chia sẻ</TableHead>
                <TableHead className="text-right">IG thích</TableHead>
                <TableHead className="text-right">IG bình luận</TableHead>
                <TableHead className="text-right">Ghim / TikTok</TableHead>
                <TableHead className="text-right">Cần tư vấn</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-sm text-muted-foreground">
                    Chưa có bài đăng nào.
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <TableRow key={r.product_id.toString()}>
                  <TableCell className="min-w-56">
                    <div className="flex items-center gap-2">
                      <Thumb src={r.image} className="size-10 shrink-0" />
                      <div className="min-w-0">
                        <Link href={`/product/${r.product_id}/edit`} className="line-clamp-2 font-medium hover:text-primary">
                          {r.name ?? `#${r.product_id}`}
                        </Link>
                        <Link href={`/social/post/index?source=Product&source_id=${r.product_id}`} className="text-xs text-muted-foreground hover:text-primary">
                          Xem các bài đăng
                        </Link>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">{n(r.posts)}</TableCell>
                  <TableCell className="text-right">{n(r.fb_likes)}</TableCell>
                  <TableCell className="text-right">{n(r.fb_comments)}</TableCell>
                  <TableCell className="text-right">{n(r.fb_shares)}</TableCell>
                  <TableCell className="text-right">{n(r.ig_likes)}</TableCell>
                  <TableCell className="text-right">{n(r.ig_comments)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {n(r.pins)} / {n(r.tiktoks)}
                  </TableCell>
                  <TableCell className={cn("text-right", n(r.leads) > 0 && "font-semibold text-destructive")}>
                    {n(r.leads) > 0 ? <Link href="/social/inbox/index">{n(r.leads)}</Link> : 0}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </ListCard>
    </>
  );
}
