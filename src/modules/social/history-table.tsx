import { ExternalLinkIcon, PlayIcon, RotateCcwIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/misc";
import { convertDateTime, strLimit } from "@/lib/helpers";
import type { HistoryRow } from "./posts";
import { FORMAT_SPECS, PLATFORM_LABEL, POST_STATUS_LABEL } from "./types";

/** Bang lich su dang (trang Lich su dang + khoi lich su o trang sua san pham/bai viet). */

export function PostStatusBadge({ status, stage }: { status: string; stage: string | null }) {
  if (status === "queued" && stage === "poll") return <Badge variant="warning">Nền tảng đang xử lý</Badge>;
  const variant = status === "published" ? "success" : status === "failed" ? "destructive" : status === "queued" ? "secondary" : status === "processing" ? "warning" : "outline";
  return <Badge variant={variant}>{POST_STATUS_LABEL[status] ?? status}</Badge>;
}

/** Nut thao tac: moi nut la mot form POST rieng (khong dat trong form khac). */
function ActionButton({ action, label, icon, variant = "ghost" }: { action: string; label: string; icon: React.ReactNode; variant?: "ghost" | "outline" }) {
  return (
    <form action={action} method="post">
      <Button type="submit" variant={variant} size="sm" title={label}>
        {icon} {label}
      </Button>
    </form>
  );
}

export function SocialHistoryTable({ rows, showSource = true, canUpdate }: { rows: HistoryRow[]; showSource?: boolean; canUpdate: boolean }) {
  const cols = showSource ? 7 : 6;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-14 text-center">#</TableHead>
          {showSource && <TableHead>Nội dung gốc</TableHead>}
          <TableHead>Kênh</TableHead>
          <TableHead>Nội dung</TableHead>
          <TableHead className="w-40 text-center">Trạng thái</TableHead>
          <TableHead className="w-36">Thời gian</TableHead>
          <TableHead className="w-44 text-right">Thao tác</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 && (
          <tr>
            <td colSpan={cols} className="py-10 text-center text-sm text-muted-foreground">
              Chưa có bài đăng nào.
            </td>
          </tr>
        )}
        {rows.map((r) => {
          const id = r.id.toString();
          const dry = Boolean(r.dry_run) || Boolean(r.meta?.dry);
          const editHref = r.source_type === "Product" ? `/product/${r.source_id}/edit` : `/post/${r.source_id}/edit`;
          return (
            <TableRow key={id}>
              <TableCell className="text-center text-muted-foreground">{id}</TableCell>
              {showSource && (
                <TableCell className="max-w-56">
                  <Link href={editHref} className="font-medium hover:text-primary">
                    {r.source_name ?? `#${r.source_id}`}
                  </Link>
                  <div className="text-xs text-muted-foreground">{r.source_type === "Product" ? "Sản phẩm" : "Bài viết"}</div>
                </TableCell>
              )}
              <TableCell>
                <div className="text-sm font-medium">{PLATFORM_LABEL[r.platform] ?? r.platform}</div>
                <div className="text-xs text-muted-foreground">
                  {r.account_name ?? "(đã ngắt)"} · {FORMAT_SPECS[r.format]?.label ?? r.format}
                </div>
                {dry && (
                  <Badge variant="warning" className="mt-1">
                    Thử (dry run)
                  </Badge>
                )}
              </TableCell>
              <TableCell className="max-w-80 text-xs">
                {r.title && <div className="font-medium">{strLimit(r.title, 80)}</div>}
                <div className="text-muted-foreground">{strLimit(r.caption, 140)}</div>
                <div className="mt-0.5 text-muted-foreground">
                  {r.media.filter((m) => m.type === "image").length} ảnh{r.media.some((m) => m.type === "video") ? " · 1 video" : ""}
                  {r.ai_generated ? " · AI" : ""}
                </div>
              </TableCell>
              <TableCell className="text-center">
                <PostStatusBadge status={r.status} stage={r.stage} />
                {r.attempts > 0 && <div className="mt-1 text-[11px] text-muted-foreground">Lần thử: {r.attempts}</div>}
                {r.error && r.status !== "published" && <div className="mt-1 max-w-56 text-left text-[11px] break-words text-destructive">{strLimit(r.error, 300)}</div>}
                {typeof r.meta?.notice === "string" && <div className="mt-1 max-w-56 text-left text-[11px] text-amber-700">{r.meta.notice}</div>}
              </TableCell>
              <TableCell className="text-xs whitespace-nowrap">
                {r.scheduled_at && r.status === "queued" && !r.stage ? (
                  <>
                    <div className="text-muted-foreground">Hẹn đăng</div>
                    {convertDateTime(r.scheduled_at)}
                  </>
                ) : r.published_at ? (
                  <>
                    <div className="text-muted-foreground">Đã đăng</div>
                    {convertDateTime(r.published_at)}
                  </>
                ) : (
                  <>
                    <div className="text-muted-foreground">Tạo lúc</div>
                    {convertDateTime(r.created_at)}
                  </>
                )}
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap items-center justify-end gap-1">
                  {r.remote_url && (
                    <Button asChild variant="ghost" size="sm">
                      <a href={r.remote_url} target="_blank" rel="noreferrer">
                        <ExternalLinkIcon /> Xem
                      </a>
                    </Button>
                  )}
                  {canUpdate && r.status === "queued" && !r.stage && <ActionButton action={`/social/post/${id}/run`} label="Chạy ngay" icon={<PlayIcon />} />}
                  {canUpdate && (r.status === "failed" || r.status === "cancelled") && <ActionButton action={`/social/post/${id}/retry`} label="Thử lại" icon={<RotateCcwIcon />} variant="outline" />}
                  {canUpdate && r.status === "queued" && !r.stage && <ActionButton action={`/social/post/${id}/cancel`} label="Hủy" icon={<XIcon />} />}
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
