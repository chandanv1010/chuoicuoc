import { notFound } from "next/navigation";
import { __ } from "@/lib/lang";
import { authorize } from "@/server/auth";
import { findDistribution } from "@/modules/distribution/distribution";
import { DeleteBox } from "@/modules/distribution/delete-box";

/** GET /distribution/{id}/delete — DistributionController@delete */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await authorize("distribution.destroy");
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const distribution = await findDistribution(BigInt(id));
  if (!distribution) notFound();
  const seo = __<Record<string, { title: string }>>("messages.distribution");
  return (
    <DeleteBox
      title={seo.delete.title}
      action={`/distribution/${distribution.id}/destroy`}
      notice="Lưu ý: không thể khôi phục nhà phân phối sau khi xóa. Hãy chắc chắn bạn muốn thực hiện chức năng này"
      name={distribution.name}
      index="/distribution/index"
      indexLabel={seo.index.title}
    />
  );
}
