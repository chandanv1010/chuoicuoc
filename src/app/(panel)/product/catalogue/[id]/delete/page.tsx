import { notFound } from "next/navigation";
import { DeleteConfirm, PageHeader } from "@/components/admin/page";
import { __ } from "@/lib/lang";
import { getCurrentLanguage } from "@/lib/language";
import { authorize } from "@/server/auth";
import { getProductCatalogueById } from "@/modules/product/product-catalogue";

export const metadata = { title: "Xóa danh mục sản phẩm" };

/** GET /product/catalogue/{id}/delete — ProductCatalogueController@delete */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await authorize("product.catalogue.destroy");
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const language = await getCurrentLanguage();
  const productCatalogue = await getProductCatalogueById(BigInt(id), language.id);
  if (!productCatalogue) notFound();
  const seo = __<Record<string, { title: string }>>("messages.productCatalogue");
  return (
    <>
      <PageHeader title={seo.delete?.title ?? "Xóa danh mục sản phẩm"} crumbs={[{ label: seo.index.title, href: "/product/catalogue/index" }, { label: "Xóa" }]} />
      <DeleteConfirm action={`/product/catalogue/${id}/destroy`} name={productCatalogue.name} backHref="/product/catalogue/index">
        {/* DeleteProductCatalogueRequest kiem tra danh muc con tren truong name */}
        <input type="hidden" name="name" value={productCatalogue.name ?? ""} />
      </DeleteConfirm>
    </>
  );
}
