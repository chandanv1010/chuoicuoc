import { notFound } from "next/navigation";
import { deliveryWindow } from "@/modules/frontend/store";
import {
  CataloguePager,
  ClearFilters,
  FilterCategories,
  FilterColors,
  FilterPrice,
  FilterRating,
  loadCatalogueListing,
  ResultCount,
  SortBar,
} from "./catalogue-parts";
import { ProductCard } from "./product-card";
import { MaybeFrame } from "./site-frame";

/**
 * Trang danh muc / tat ca san pham / ket qua tim kiem kieu Amazon
 * (thay ProductCatalogueController@index, @all + product/catalogue/index.blade.php).
 * URL giu nguyen: /<canonical>.html, /<canonical>/page-N.html, /products.html?keyword=.
 * Bo loc qua query: product_catalogue_id, price, low_price, high_price, color, rating, sort.
 * Tung phan (bo loc, so ket qua, sap xep, phan trang) nam o catalogue-parts.tsx — dung chung voi template.
 */
export async function ProductCatalogueView({
  catalogueId,
  page,
  query,
  bare,
}: {
  catalogueId: bigint | null;
  page: number;
  query: [string, string][];
  /** chi phan than trang (khoi "Toàn bộ trang danh mục" cu trong template) */
  bare?: boolean;
}) {
  const args = { catalogueId, page, query };
  const d = await loadCatalogueListing(args);
  if (!d) notFound();
  const { filters, result } = d;
  const delivery = deliveryWindow();

  const sidebar = (
    <div className="space-y-6 rounded-2xl border border-az-border bg-white p-5">
      <FilterCategories {...args} />
      <FilterPrice {...args} />
      <FilterColors {...args} />
      <FilterRating {...args} />
      <ClearFilters {...args} />
    </div>
  );

  return (
    <MaybeFrame bare={bare} seo={d.pageSeo} search={{ keyword: filters.keyword, catalogueId: catalogueId === null ? filters.catalogueId : null }}>
      {/* Thanh ket qua */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-az-border px-4 py-2 shadow-[0_2px_4px_rgba(0,0,0,0.06)]">
        <ResultCount {...args} />
        <SortBar {...args} />
      </div>

      <div className="mx-auto flex max-w-[1500px] gap-6 px-4 py-4">
        <aside className="hidden w-[250px] shrink-0 self-start md:sticky md:top-3 md:block" aria-label="Filters">
          {sidebar}
        </aside>

        <div className="min-w-0 flex-1">
          <details className="mb-3 md:hidden">
            <summary className="w-fit cursor-pointer rounded-full border border-az-border bg-white px-4 py-1.5 text-sm font-semibold">Bộ lọc</summary>
            <div className="mt-2">{sidebar}</div>
          </details>

          <h1 className="az-h1">{filters.keyword ? "Results" : d.title}</h1>
          {!filters.keyword && d.description ? <p className="mt-1 max-w-3xl text-sm text-az-muted">{d.description}</p> : null}
          {filters.keyword ? <p className="text-sm text-az-muted">Liên hệ với chúng tôi để được tư vấn và báo giá.</p> : null}

          {result.items.length > 0 ? (
            <ul className="mt-4 grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
              {result.items.map((p) => (
                <li key={p.id} className="border-b border-az-border pb-2 sm:border-0">
                  <ProductCard product={p} delivery={delivery} />
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-6 rounded-lg border border-az-border p-6">
              <p className="text-lg font-bold">Không tìm thấy sản phẩm{filters.keyword ? ` cho "${filters.keyword}"` : ""}.</p>
              <p className="mt-1 text-sm">Thử kiểm tra chính tả, bỏ bớt bộ lọc hoặc dùng từ khóa chung hơn.</p>
              <a href="/products.html" className="az-link mt-3 inline-block text-sm">
                Browse all products
              </a>
            </div>
          )}

          <CataloguePager {...args} />
        </div>
      </div>
    </MaybeFrame>
  );
}
