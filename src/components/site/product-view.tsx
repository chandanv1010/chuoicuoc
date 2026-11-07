import { notFound } from "next/navigation";
import { seo } from "@/modules/frontend/helpers";
import {
  loadProductPage,
  ProductBreadcrumb,
  ProductBuyBox,
  ProductDescription,
  ProductDetailsTable,
  ProductGallerySection,
  ProductRelated,
  ProductReviewsSection,
} from "./product-parts";
import { SiteFrame } from "./site-frame";

/**
 * Trang chi tiet san pham kieu Amazon (thay ProductController@index + product/product/index.blade.php):
 * thu vien anh, tieu de + danh gia, gia + bien the, hop mua hang, mo ta, thong so,
 * danh gia khach hang (bang reviews, chi hien da duyet), san pham lien quan.
 * Cac phan nam o product-parts.tsx (dung chung voi template cua trinh dung giao dien).
 */
export async function ProductView({ productId }: { productId: bigint }) {
  const d = await loadProductPage(productId);
  if (!d) notFound();

  return (
    <SiteFrame seo={seo(d.product)}>
      <ProductBreadcrumb productId={productId} />

      <div className="mx-auto grid max-w-[1500px] gap-6 px-4 py-4 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:grid-cols-[minmax(0,4fr)_minmax(0,6fr)]">
        {/* Anh dinh theo khi cuoi o tablet/desktop de cot trai khong bi trong duoi anh */}
        <div className="min-w-0 md:sticky md:top-2 md:self-start">
          <ProductGallerySection productId={productId} />
        </div>
        <ProductBuyBox productId={productId} />
      </div>

      {d.related.length > 0 && (
        <div className="mx-auto max-w-[1500px] border-t border-az-border">
          <ProductRelated productId={productId} />
        </div>
      )}

      <div className="mx-auto max-w-[1500px] space-y-8 border-t border-az-border px-4 py-6">
        <ProductDescription productId={productId} />
        <ProductDetailsTable productId={productId} />
        <div className="border-t border-az-border pt-6">
          <ProductReviewsSection productId={productId} />
        </div>
      </div>
    </SiteFrame>
  );
}
