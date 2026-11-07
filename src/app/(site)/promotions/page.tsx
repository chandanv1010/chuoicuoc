import { Tag } from "lucide-react";
import { MiniCard } from "@/components/site/product-card";
import { ProductRow } from "@/components/site/product-row";
import { SiteFrame } from "@/components/site/site-frame";
import { db } from "@/lib/db";
import { now } from "@/lib/helpers";
import { url } from "@/modules/frontend/helpers";
import { STORE, usDate } from "@/modules/frontend/store";
import { getHomeProducts } from "@/modules/frontend/storefront";

/**
 * GET /promotions — cac chuong trinh khuyen mai dang chay (bang promotions: publish=2,
 * da bat dau, chua het han hoac khong co ngay ket thuc) + hang san pham ban chay.
 */
type Promo = { id: bigint; name: string; description: string | null; code: string | null; startDate: Date | null; endDate: Date | null; neverEndDate: string | null };

export default async function PromotionsPage() {
  const t = now();
  const [promos, rows] = await Promise.all([
    db.$queryRaw<Promo[]>`
      SELECT id, name, description, code, startDate, endDate, neverEndDate FROM promotions
      WHERE deleted_at IS NULL AND publish = 2 AND (startDate IS NULL OR startDate <= ${t})
        AND (neverEndDate = 'accept' OR endDate IS NULL OR endDate >= ${t})
      ORDER BY \`order\` DESC, id DESC`,
    getHomeProducts(),
  ]);
  const seo = {
    meta_title: `Promotions – CustomStitch House`,
    meta_keyword: "",
    meta_description: `Current offers and deals on embroidered hats, bags and coasters from CustomStitch House.`,
    meta_image: "",
    canonical: url("promotions"),
  };

  return (
    <SiteFrame seo={seo} bg="gray">
      <div className="mx-auto max-w-[1500px] space-y-5 px-3 py-5 sm:px-5">
        <header className="rounded-2xl bg-[linear-gradient(160deg,#f6dccf_0%,#f3e6dc_100%)] px-6 py-8">
          <h1 className="font-display text-3xl font-bold lg:text-4xl">Promotions</h1>
          <p className="mt-2 max-w-xl text-sm text-az-text/75">Seasonal offers, bundle deals and discounts on our embroidered pieces.</p>
        </header>

        {promos.length === 0 ? (
          <section className="rounded-xl border border-az-border bg-white px-6 py-10 text-center">
            <Tag className="mx-auto size-10 text-az-muted" aria-hidden="true" />
            <p className="mt-3 font-display text-xl font-semibold">No active promotions right now</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-az-muted">
              New offers are announced here and on our social channels. Every order already ships free to the United States.
            </p>
          </section>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {promos.map((p) => (
              <li key={String(p.id)} className="flex flex-col rounded-xl border border-az-border bg-white p-5">
                <span className="inline-flex w-fit items-center gap-1 rounded-full bg-az-cart px-2.5 py-0.5 text-xs font-semibold text-white">
                  <Tag className="size-3" aria-hidden="true" /> Offer
                </span>
                <h2 className="mt-3 font-display text-lg font-semibold">{p.name}</h2>
                {p.description && (
                  <div className="az-prose mt-1 text-az-muted" dangerouslySetInnerHTML={{ __html: p.description }} />
                )}
                <p className="mt-auto pt-3 text-xs text-az-muted">
                  {p.neverEndDate === "accept" || !p.endDate ? "Ongoing offer" : `Ends ${usDate(p.endDate)}`}
                  {p.code ? ` · Code ${p.code}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}

        <ProductRow title="Best sellers" href="/products.html">
          {rows.bestSellers.map((p) => (
            <MiniCard key={p.id} product={p} />
          ))}
        </ProductRow>
      </div>
    </SiteFrame>
  );
}
