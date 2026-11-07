import { ExternalLinkIcon, LinkIcon, RotateCcwIcon, UnlinkIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { Thumb } from "@/components/admin/page";
import { Button } from "@/components/ui/button";
import { Badge, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/misc";
import { convertDateTime } from "@/lib/helpers";
import type { ListingRow } from "./listings";
import { LISTING_STATUS_LABEL, MARKETPLACE_INFO } from "./types";

/** Bang trang thai san pham tren san (trang danh sach + trang sua san pham). Nut = form POST rieng. */

type Row = ListingRow & { product_name?: string | null; product_image?: string | null; account_name?: string | null };

function Action({ action, label, icon, variant = "ghost" }: { action: string; label: string; icon: React.ReactNode; variant?: "ghost" | "outline" }) {
  return (
    <form action={action} method="post">
      <Button type="submit" variant={variant} size="sm" title={label}>
        {icon}
        <span className="sr-only sm:not-sr-only">{label}</span>
      </Button>
    </form>
  );
}

const STATUS_VARIANT: Record<string, "success" | "warning" | "destructive" | "secondary"> = { synced: "success", queued: "warning", processing: "warning", failed: "destructive", idle: "secondary" };

export function ListingTable({ rows, showProduct, canUpdate }: { rows: Row[]; showProduct: boolean; canUpdate: boolean }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {showProduct && <TableHead>Sản phẩm</TableHead>}
          <TableHead>Sàn / shop</TableHead>
          <TableHead className="w-40">Trạng thái</TableHead>
          <TableHead>Trên sàn</TableHead>
          <TableHead className="w-40">Đồng bộ lúc</TableHead>
          <TableHead className="w-56 text-right">Thao tác</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 && (
          <tr>
            <td colSpan={showProduct ? 6 : 5} className="py-10 text-center text-sm text-muted-foreground">
              Chưa có sản phẩm nào được đưa lên sàn.
            </td>
          </tr>
        )}
        {rows.map((r) => {
          const id = r.id.toString();
          return (
            <TableRow key={id}>
              {showProduct && (
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Thumb src={r.product_image} />
                    <Link href={`/product/${r.product_id}/edit`} className="line-clamp-2 max-w-72 text-sm font-medium hover:underline">
                      {r.product_name ?? `#${r.product_id}`}
                    </Link>
                  </div>
                </TableCell>
              )}
              <TableCell>
                <div className="text-sm font-medium">{MARKETPLACE_INFO[r.platform]?.label ?? r.platform}</div>
                <div className="text-xs text-muted-foreground">{r.account_name ?? ""}</div>
                {Boolean(r.dry_run) && (
                  <Badge variant="warning" className="mt-1">
                    Dry run
                  </Badge>
                )}
              </TableCell>
              <TableCell>
                <Badge variant={STATUS_VARIANT[r.status] ?? "secondary"}>{LISTING_STATUS_LABEL[r.status] ?? r.status}</Badge>
                {r.stage && r.status !== "synced" && <div className="mt-1 text-[11px] text-muted-foreground">bước: {r.stage}</div>}
                {r.error && <div className="mt-1 max-w-64 text-[11px] text-destructive">{r.error}</div>}
                {r.progress?.notice && <div className="mt-1 max-w-64 text-[11px] text-amber-700">{r.progress.notice}</div>}
              </TableCell>
              <TableCell className="text-sm">
                {r.remote_id ? (
                  <>
                    <div>
                      #{r.remote_id} {r.remote_state && <span className="text-xs text-muted-foreground">({r.remote_state})</span>}
                    </div>
                    {r.remote_url && (
                      <a href={r.remote_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                        <ExternalLinkIcon className="size-3" /> Mở trên sàn
                      </a>
                    )}
                  </>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">{r.synced_at ? convertDateTime(r.synced_at) : "—"}</TableCell>
              <TableCell>
                <div className="flex justify-end gap-1">
                  {canUpdate && ["failed", "synced", "idle"].includes(r.status) && (
                    <Action action={`/marketplace/listing/${id}/retry`} label={r.status === "failed" ? "Thử lại" : r.remote_id ? "Đồng bộ lại" : "Đẩy"} icon={<RotateCcwIcon />} variant="outline" />
                  )}
                  {canUpdate && r.status === "queued" && <Action action={`/marketplace/listing/${id}/cancel`} label="Hủy" icon={<XIcon />} />}
                  {canUpdate && r.remote_id && r.status !== "processing" && <Action action={`/marketplace/listing/${id}/unlink`} label="Bỏ liên kết" icon={<UnlinkIcon />} />}
                  {!showProduct && !r.remote_id && r.status === "idle" && (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <LinkIcon className="size-3" /> đã lưu lựa chọn
                    </span>
                  )}
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
