import { CategoryHero } from "@/components/site/category-hero";
import { MiniCard } from "@/components/site/product-card";
import { ProductRow } from "@/components/site/product-row";
import { SiteFrame } from "@/components/site/site-frame";
import { getSystem } from "@/lib/language";
import { url } from "@/modules/frontend/helpers";
import { STORE } from "@/modules/frontend/store";
import { getHomeHeroCards } from "@/modules/frontend/home";
import { getHomeProducts } from "@/modules/frontend/storefront";
import { resolveBlockData } from "@/modules/builder/data";
import { getPublishedDoc } from "@/modules/builder/pages";
import { BuilderTree } from "@/modules/builder/render";
import { renderSlots } from "@/modules/builder/slots";

/**
 * Trang chu EMHAUS kieu Amazon (thay HomeController@index + home/index.blade.php cua WACO):
 * banner tu anh san pham, the danh muc 2x2, cac hang san pham cuon ngang.
 */
export default async function HomePage() {
  const system = await getSystem();

  const seo = {
    meta_title: system.seo_meta_title || `Chổi Cước Việt Nam – ${STORE.tagline}`,
    meta_keyword: system.seo_meta_keyword ?? "",
    meta_description: system.seo_meta_description || STORE.tagline,
    meta_image: system.seo_meta_images ?? "",
    canonical: url("/").replace(/\/?$/, "/"),
  };

  // Da xuat ban tu trinh dung giao dien (/builder/home/edit) thi dung ban do, chua thi giu giao dien code cung
  const built = await getPublishedDoc("home");
  if (built) {
    return (
      <SiteFrame seo={seo} bg="gray" settings={built.settings}>
        <BuilderTree doc={built} data={await resolveBlockData(built)} slots={renderSlots(built, null)} />
      </SiteFrame>
    );
  }
  const [heroCards, rows] = await Promise.all([getHomeHeroCards(), getHomeProducts()]);

  return (
    <SiteFrame seo={seo} bg="gray">
      <div className="mx-auto max-w-[1500px]">
        {/* Chi 3 danh muc chinh (Hats / Bags / Coasters) — khong lap lai bang the 2x2 */}
        <CategoryHero cards={heroCards} />

        <div className="space-y-5 px-3 py-5 sm:px-5">
          <ProductRow title="Sản phẩm nổi bật" href="/products.html">
            {rows.bestSellers.map((p) => (
              <MiniCard key={p.id} product={p} />
            ))}
          </ProductRow>
          {rows.christmas.length > 0 && (
            <ProductRow title="Sản phẩm bán chạy" href="/products.html">
              {rows.christmas.map((p) => (
                <MiniCard key={p.id} product={p} />
              ))}
            </ProductRow>
          )}
          <ProductRow title="Hàng mới về" href="/products.html?sort=newest">
            {rows.newest.map((p) => (
              <MiniCard key={p.id} product={p} />
            ))}
          </ProductRow>

          <section className="grid gap-4 bg-white p-5 sm:grid-cols-3" aria-label="Vì sao chọn chúng tôi">
            {[
              ["Hàng theo yêu cầu", "Nhận gia công chổi cước theo kích thước, loại sợi và kiểu trục bạn cần."],
              ["Giao hàng toàn quốc", "Đóng gói chắc chắn, giao nhanh trên toàn quốc."],
              ["Tư vấn kỹ thuật", "Hỗ trợ chọn đúng loại chổi cước cho máy và nhu cầu của bạn."],
            ].map(([h, d]) => (
              <div key={h}>
                <h2 className="text-base font-bold">{h}</h2>
                <p className="mt-1 text-sm text-az-muted">{d}</p>
              </div>
            ))}
          </section>
        </div>
      </div>
    </SiteFrame>
  );
}
