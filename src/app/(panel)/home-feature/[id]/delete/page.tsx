import { notFound } from "next/navigation";
import { DeleteConfirm, PageHeader } from "@/components/admin/page";
import { __ } from "@/lib/lang";
import { authorize } from "@/server/auth";
import { findFeature, tenNhom } from "@/modules/home-feature/home-feature";

/** GET /home-feature/{id}/delete — HomeFeatureController@delete (view backend/home_feature/delete.blade.php) */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await authorize("home.feature.destroy");
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const feature = await findFeature(BigInt(id));
  if (!feature) notFound();
  const seo = __<Record<string, { title: string }>>("messages.homeFeature");
  return (
    <>
      <PageHeader title={seo.delete.title} crumbs={[{ label: seo.index.title, href: "/home-feature/index" }, { label: "Xóa" }]} />
      <DeleteConfirm action={`/home-feature/${feature.id}/destroy`} name={feature.title.replaceAll("\n", " ")} title={seo.delete.title} backHref="/home-feature/index">
        <dl className="grid grid-cols-[110px_1fr] gap-1 rounded-md border bg-muted/30 p-3">
          <dt className="text-muted-foreground">Khối hiển thị</dt>
          <dd>{tenNhom(feature.group)}</dd>
          <dt className="text-muted-foreground">Con số</dt>
          <dd>{feature.value || "—"}</dd>
        </dl>
        <p className="text-destructive">
          Số mục trong mỗi khối đã được thiết kế cố định. Xóa bớt sẽ làm lệch bố cục trang chủ. Nếu chỉ muốn tạm ẩn, hãy quay lại và tắt công tắc ở cột Tình trạng.
        </p>
      </DeleteConfirm>
    </>
  );
}
