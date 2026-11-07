import { PlayIcon } from "lucide-react";
import Link from "next/link";
import { AutoSubmitField } from "@/components/admin/fields";
import { ListCard, PageHeader } from "@/components/admin/page";
import { AdminPagination, makePaginator } from "@/components/admin/pagination";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { param, type SearchParams } from "@/server/admin-list";
import { authorize, can } from "@/server/auth";
import { SocialHistoryTable } from "@/modules/social/history-table";
import { countByStatus, paginateHistory } from "@/modules/social/posts";
import { PLATFORM_LABEL, PLATFORMS, POST_STATUS_LABEL } from "@/modules/social/types";
import { startSocialWorker } from "@/modules/social/worker";

export const metadata = { title: "Lịch sử đăng mạng xã hội" };

/** GET /social/post/index — Lich su dang: loc theo kenh, trang thai, nguon; thu lai / huy / chay ngay. */
export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const admin = await authorize("social.post.index");
  startSocialWorker();
  const sp = await searchParams;
  const [{ rows, total, perPage, page }, counts] = await Promise.all([paginateHistory(sp), countByStatus()]);
  const canUpdate = can(admin, "social.post.update");
  const status = param(sp, "status") ?? "";
  const qs = (patch: Record<string, string>) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries({ platform: param(sp, "platform") ?? "", source: param(sp, "source") ?? "", source_id: param(sp, "source_id") ?? "", status, ...patch })) if (v) q.set(k, v);
    const s = q.toString();
    return `/social/post/index${s ? `?${s}` : ""}`;
  };
  const totalAll = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <>
      <PageHeader
        title="Lịch sử đăng"
        crumbs={[{ label: "Mạng xã hội" }, { label: "Lịch sử đăng" }]}
        description="Hàng đợi và kết quả đăng sản phẩm / bài viết lên mạng xã hội. Trang không tự làm mới — tải lại để xem trạng thái mới."
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/social/account/index">Tài khoản kết nối</Link>
            </Button>
            {canUpdate && (
              <form action="/social/post/run" method="post">
                <Button type="submit">
                  <PlayIcon /> Chạy hàng đợi ngay
                </Button>
              </form>
            )}
          </>
        }
      />
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[...Object.entries(POST_STATUS_LABEL), ["", "Tất cả"]].map(([k, label]) => {
          const n = k ? (counts[k] ?? 0) : totalAll;
          const active = k === status;
          return (
            <Link key={k || "all"} href={qs({ status: k, page: "" })} className={cn("rounded-lg border bg-card p-3 text-sm transition-colors hover:border-primary", active && "border-primary ring-2 ring-primary/20")}>
              <div className="text-muted-foreground">{label}</div>
              <div className="mt-1 text-lg font-semibold">{n}</div>
            </Link>
          );
        })}
      </div>
      <ListCard title="Bài đăng">
        <form action="/social/post/index" className="flex flex-wrap items-center gap-2 pb-4">
          {param(sp, "source_id") && <input type="hidden" name="source_id" value={param(sp, "source_id")} />}
          <AutoSubmitField name="platform" defaultValue={param(sp, "platform") ?? ""} className="w-44">
            <option value="">Tất cả kênh</option>
            {PLATFORMS.map((p) => (
              <option key={p} value={p}>
                {PLATFORM_LABEL[p]}
              </option>
            ))}
          </AutoSubmitField>
          <AutoSubmitField name="status" defaultValue={status} className="w-40">
            <option value="">Tất cả trạng thái</option>
            {Object.entries(POST_STATUS_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </AutoSubmitField>
          <AutoSubmitField name="source" defaultValue={param(sp, "source") ?? ""} className="w-40">
            <option value="">Mọi nguồn</option>
            <option value="Product">Sản phẩm</option>
            <option value="Post">Bài viết</option>
          </AutoSubmitField>
          {param(sp, "source_id") && (
            <Link href={qs({ source_id: "", source: "" })} className="text-sm text-primary hover:underline">
              Bỏ lọc #{param(sp, "source_id")}
            </Link>
          )}
        </form>
        <SocialHistoryTable rows={rows} canUpdate={canUpdate} />
        <AdminPagination paginator={makePaginator(total, perPage, page, "/social/post/index", sp)} />
      </ListCard>
    </>
  );
}
