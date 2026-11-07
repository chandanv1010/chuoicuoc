import { notFound } from "next/navigation";
import { DeleteConfirm, PageHeader } from "@/components/admin/page";
import { __ } from "@/lib/lang";
import { getCurrentLanguage } from "@/lib/language";
import { authorize } from "@/server/auth";
import { getProductById } from "@/modules/product/product";

export const metadata = { title: "Xóa sản phẩm" };

/** GET /product/{id}/delete — ProductController@delete */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await authorize("product.destroy");
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const language = await getCurrentLanguage();
  const product = await getProductById(BigInt(id), language.id);
  if (!product) notFound();
  const seo = __<Record<string, { title: string }>>("messages.product");
  return (
    <>
      <PageHeader title="Xóa sản phẩm" crumbs={[{ label: seo.index.title, href: "/product/index" }, { label: "Xóa" }]} />
      <DeleteConfirm action={`/product/${id}/destroy`} name={product.name} backHref="/product/index">
        <input type="hidden" name="name" value={product.name ?? ""} />
      </DeleteConfirm>
    </>
  );
}
