/* eslint-disable @next/next/no-img-element -- anh qua route /thumb */
import { SiteFrame } from "@/components/site/site-frame";
import { writeUrl } from "@/modules/frontend/helpers";
import { thumbUrl } from "@/modules/frontend/image";
import { siteName } from "@/lib/site";
import { getStoreCatalogues } from "@/modules/frontend/storefront";

/**
 * GET /about.html — trang "Giới thiệu". Noi dung viet san cho site choi cuoc.
 */
export default async function AboutPage() {
  const [catalogues, shop] = await Promise.all([getStoreCatalogues(), siteName()]);
  const seo = {
    meta_title: `Giới thiệu ${shop}`,
    meta_keyword: "",
    meta_description: `${shop} chuyên sản xuất và cung cấp chổi cước công nghiệp: con lăn cước, thanh chổi cước chặn cửa, chổi cước đánh rỉ và nhiều loại chổi cước theo yêu cầu.`,
    meta_image: "",
    canonical: writeUrl("about"),
  };
  const hero = [...new Set(catalogues.map((c) => c.images[0]).filter(Boolean))].slice(0, 3);

  return (
    <SiteFrame seo={seo}>
      <div className="mx-auto max-w-[1000px] px-4 py-8">
        <p className="text-sm font-bold tracking-wide text-az-orange uppercase">Giới thiệu</p>
        <h1 className="mt-1 text-3xl leading-tight font-bold sm:text-4xl">Chuyên chổi cước công nghiệp</h1>
        <p className="mt-4 max-w-3xl text-base leading-7">
          {shop} là đơn vị sản xuất và cung cấp các loại chổi cước công nghiệp: con lăn cước, thanh chổi cước chặn cửa, chổi cước đánh rỉ
          và nhiều loại chổi cước chuyên dụng khác. Chúng tôi nhận gia công theo yêu cầu về kích thước, loại sợi (nylon, PP, inox), đường
          kính và kiểu trục, phục vụ máy móc, dây chuyền sản xuất và nhà xưởng trên toàn quốc.
        </p>
        {hero.length > 0 && (
          <div className="mt-6 grid grid-cols-3 gap-3">
            {hero.map((src, i) => (
              <img key={i} src={thumbUrl(src, 500)} alt="" className="aspect-square w-full rounded-lg object-cover" loading={i ? "lazy" : "eager"} />
            ))}
          </div>
        )}
        <div className="mt-8 grid gap-6 sm:grid-cols-3">
          {[
            ["Hàng theo yêu cầu", "Nhận gia công chổi cước theo đúng kích thước, loại sợi và kiểu trục bạn cần cho từng loại máy."],
            ["Chất liệu bền", "Sợi nylon, PP, inox chọn lọc; trục thép hoặc inox chắc chắn, chịu mài mòn và chịu nhiệt tốt."],
            ["Giao hàng toàn quốc", "Đóng gói chắc chắn, hỗ trợ giao hàng nhanh trên toàn quốc và tư vấn kỹ thuật tận tình."],
          ].map(([h, d]) => (
            <section key={h} className="rounded-lg border border-az-border p-5">
              <h2 className="text-lg font-bold">{h}</h2>
              <p className="mt-2 text-sm text-az-muted">{d}</p>
            </section>
          ))}
        </div>
        <section className="mt-10" aria-labelledby="shop-h">
          <h2 id="shop-h" className="az-h2 mb-3">
            Danh mục sản phẩm
          </h2>
          <ul className="flex flex-wrap gap-3">
            {catalogues.map((c) => (
              <li key={c.id}>
                <a href={`/${c.canonical}.html`} className="az-btn az-btn-secondary">
                  {c.name}
                </a>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </SiteFrame>
  );
}
