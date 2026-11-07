/* eslint-disable @next/next/no-img-element -- anh qua route co kiem tra quyen */
import Link from "next/link";
import { EmptyRow, ListCard, PageHeader } from "@/components/admin/page";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/misc";
import { CAP_COLORS, coasterColor, TSHIRT_COLORS } from "@/modules/design/config";
import { listDesignRequests } from "@/modules/design/requests";
import { authorize } from "@/server/auth";

export const metadata = { title: "Thiết kế khách gửi" };

/** GET /design-request/index — danh sach thiet ke khach gui tu trang /design, moi nhat truoc. */
export default async function DesignRequestIndex() {
  await authorize("order.index");
  const rows = await listDesignRequests();
  return (
    <>
      <PageHeader title="Thiết kế khách gửi" crumbs={[{ label: "Thiết kế khách gửi" }]} description="Khách đặt hình/chữ lên mũ 3D hoặc khăn rồi gửi về xưởng. Xưởng làm file máy thêu và gửi proof cho khách." />
      <ListCard title="Danh sách thiết kế">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">Ảnh</TableHead>
              <TableHead>Mã</TableHead>
              <TableHead>Khách</TableHead>
              <TableHead>Sản phẩm</TableHead>
              <TableHead>Chi tiết</TableHead>
              <TableHead>Ngày gửi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && <EmptyRow colSpan={6} text="Chưa có thiết kế nào." />}
            {rows.map((r) => {
              const color = r.spec.product === "hat" ? CAP_COLORS.find((c) => c.key === r.spec.color) : r.spec.product === "tshirt" ? TSHIRT_COLORS.find((c) => c.key === r.spec.color) : coasterColor(r.spec.material, r.spec.color);
              const first = r.views[0];
              return (
                <TableRow key={r.id}>
                  <TableCell>
                    {first && <img src={`/design-request/${r.id}/file/${first}`} alt="" className="size-16 rounded border object-cover" />}
                  </TableCell>
                  <TableCell>
                    <Link href={`/design-request/${r.id}`} className="font-mono font-semibold text-primary hover:underline">
                      {r.code}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{r.customer.name}</div>
                    <div className="text-xs text-muted-foreground">{r.customer.email}</div>
                  </TableCell>
                  <TableCell>
                    {r.spec.product === "hat" ? "Mũ" : r.spec.product === "tshirt" ? "Áo phông" : "Khăn"} · {color?.label ?? r.spec.color} · SL {r.customer.quantity}
                  </TableCell>
                  <TableCell className="text-sm">{r.spec.items.length} hình/chữ</TableCell>
                  <TableCell className="whitespace-nowrap text-sm">{new Date(r.created_at).toLocaleString("vi-VN")}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </ListCard>
    </>
  );
}
