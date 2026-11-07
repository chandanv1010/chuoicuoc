import { notFound } from "next/navigation";
import { __ } from "@/lib/lang";
import { authorize } from "@/server/auth";
import { findArea } from "@/modules/distribution/distribution";
import { DeleteBox } from "@/modules/distribution/delete-box";

/** GET /distribution/area/{id}/delete — DistributionAreaController@delete */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await authorize("distribution.area.destroy");
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const area = await findArea(BigInt(id));
  if (!area) notFound();
  const seo = __<Record<string, { title: string }>>("messages.distributionArea");
  return (
    <DeleteBox
      title={seo.delete.title}
      action={`/distribution/area/${area.id}/destroy`}
      notice="Lưu ý: không thể khôi phục khu vực sau khi xóa. Hãy chắc chắn bạn muốn thực hiện chức năng này"
      name={area.name}
      index="/distribution/area/index"
      indexLabel={seo.index.title}
    />
  );
}
