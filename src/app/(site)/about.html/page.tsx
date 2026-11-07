/* eslint-disable @next/next/no-img-element -- anh qua route /thumb */
import { SiteFrame } from "@/components/site/site-frame";
import { writeUrl } from "@/modules/frontend/helpers";
import { thumbUrl } from "@/modules/frontend/image";
import { STORE } from "@/modules/frontend/store";
import { getStoreCatalogues } from "@/modules/frontend/storefront";

/**
 * GET /about.html — trang "About EMHAUS" (thay AboutController@index cua WACO;
 * noi dung introduces/home_features cua WACO khong con phu hop nen viet san tai day).
 */
export default async function AboutPage() {
  const catalogues = await getStoreCatalogues();
  const seo = {
    meta_title: `About CustomStitch House`,
    meta_keyword: "",
    meta_description: `CustomStitch House is a small machine-embroidery studio in Vietnam making custom hats and linen napkins for customers in the United States.`,
    meta_image: "",
    canonical: writeUrl("about"),
  };
  // Moi danh muc mot anh (danh muc cha va con co the trung anh) -> bo trung
  const hero = [...new Set(catalogues.map((c) => c.images[0]).filter(Boolean))].slice(0, 3);

  return (
    <SiteFrame seo={seo}>
      <div className="mx-auto max-w-[1000px] px-4 py-8">
        <p className="text-sm font-bold tracking-wide text-az-orange uppercase">About us</p>
        <h1 className="mt-1 text-3xl leading-tight font-bold sm:text-4xl">Small-batch embroidery, stitched in Vietnam</h1>
        <p className="mt-4 max-w-3xl text-base leading-7">
          CustomStitch House is a family-run embroidery studio. We design and machine-embroider dad hats, baseball caps and linen cocktail napkins one
          order at a time, then ship them to homes across the United States. Many of our pieces are personalized — a name on a cap, a pet on a
          napkin, a couple&apos;s initials for a gift.
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
            ["Made to order", "Nothing sits in a warehouse. Each item is stitched after you order, so personalization is always possible."],
            ["Quality materials", "Soft cotton twill caps with adjustable straps and natural linen-blend napkins that wash well."],
            ["Shipped to the US", `Tracked international shipping from ${STORE.shipsFrom}. Most orders arrive in ${STORE.deliveryDays[0]}–${STORE.deliveryDays[1]} days.`],
          ].map(([h, d]) => (
            <section key={h} className="rounded-lg border border-az-border p-5">
              <h2 className="text-lg font-bold">{h}</h2>
              <p className="mt-2 text-sm text-az-muted">{d}</p>
            </section>
          ))}
        </div>
        <section className="mt-10" aria-labelledby="shop-h">
          <h2 id="shop-h" className="az-h2 mb-3">
            Shop our collections
          </h2>
          <ul className="flex flex-wrap gap-3">
            {catalogues.map((c) => (
              <li key={c.id}>
                <a href={`/${c.canonical}.html`} className="az-btn az-btn-secondary">
                  {c.name}
                </a>
              </li>
            ))}
            <li>
              <a href={STORE.etsyUrl} target="_blank" rel="noopener noreferrer" className="az-btn az-btn-secondary">
                Visit us on Etsy
              </a>
            </li>
          </ul>
        </section>
      </div>
    </SiteFrame>
  );
}
