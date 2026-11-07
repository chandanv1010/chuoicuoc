/* eslint-disable @next/next/no-img-element -- anh danh gia upload */
import { Check, Lock, MapPin, RotateCcw, Truck } from "lucide-react";
import { cache, Fragment } from "react";
import { siteName } from "@/lib/site";
import { FRONTEND_LANGUAGE } from "@/modules/frontend/core";
import { phpTruthy, textLines } from "@/modules/frontend/helpers";
import { decodeAlbum, getProductById, getProductCatalogueById } from "@/modules/frontend/product";
import { currentCustomer } from "@/modules/frontend/shop/customer";
import { deliveryWindow, PRODUCT_REVIEWABLE, STORE, usDate } from "@/modules/frontend/store";
import { getProductPurchaseData, getProductReviews, getRelatedStoreProducts } from "@/modules/frontend/storefront";
import type { BuyData } from "./buy-state";
import { BuyButton, BuyOptions, BuyPrice, BuyQty, BuySku, BuyStock } from "./buy-widgets";
import { MiniCard } from "./product-card";
import { ProductGallery, type GalleryOpts } from "./product-gallery";
import { ProductPurchase } from "./product-purchase";
import { ProductRow } from "./product-row";
import { ReviewForm } from "./review-form";
import { Stars } from "./stars";

/**
 * Cac phan cua trang chi tiet san pham (anh, hop mua hang, mo ta, thong so, danh gia, lien quan) tach rieng de
 * dung chung: trang code cung (product-view.tsx) ghep lai nhu cu, template cua trinh dung giao dien dat tung phan
 * nhu mot khoi. Du lieu nap mot lan moi request (cache) du nhieu phan cung goi.
 */
export const loadProductPage = cache(async (productId: bigint) => {
  const language = FRONTEND_LANGUAGE;
  const product = await getProductById(productId, language);
  if (!product) return null;
  const [catalogue, purchase, reviews, related, customer, shop] = await Promise.all([
    getProductCatalogueById(BigInt(product.product_catalogue_id), language),
    getProductPurchaseData(productId),
    getProductReviews(productId),
    getRelatedStoreProducts(productId, product.product_catalogue_id),
    currentCustomer(),
    siteName(),
  ]);
  const name = phpTruthy(product.name) ? product.name : (product.code ?? "");
  const images = [product.image, ...decodeAlbum(product.album)].filter(phpTruthy) as string[];
  const catHref = catalogue?.canonical ? `/${catalogue.canonical}.html` : "/products.html";
  // "About this item": cac dong co nghia trong mo ta dai (hoac mo ta ngan)
  const bullets = textLines(product.content || product.description)
    .filter((l) => l.length > 25)
    .slice(0, 7);
  const specs = textLines(product.specification).map((line) => {
    const i = line.indexOf(":");
    return i >= 0 ? ([line.slice(0, i).trim(), line.slice(i + 1).trim()] as [string, string]) : ([line, ""] as [string, string]);
  });
  const details: [string, string][] = [
    ["Thương hiệu", shop],
    ...(catalogue ? ([["Danh mục", catalogue.name]] as [string, string][]) : []),
    ...(product.code ? ([["Mã sản phẩm", product.code]] as [string, string][]) : []),
    ...(STORE.origin ? ([["Xuất xứ", STORE.origin]] as [string, string][]) : []),
    ...(STORE.shipsFrom ? ([["Gửi từ", STORE.shipsFrom]] as [string, string][]) : []),
    ["Bán bởi", shop],
    ...specs,
  ];
  return { productId, product, catalogue, purchase, reviews, related, customer, shop, name, images, catHref, bullets, details };
});

type P = { productId: bigint };

export async function ProductBreadcrumb({ productId }: P) {
  const d = await loadProductPage(productId);
  if (!d) return null;
  return (
    <nav aria-label="Breadcrumb" className="px-4 pt-3 text-xs text-az-muted">
      <ol className="flex flex-wrap items-center gap-1">
        <li>
          <a href="/products.html" className="hover:text-az-link-hover hover:underline">
            Tất cả sản phẩm
          </a>
        </li>
        {d.catalogue && (
          <>
            <li aria-hidden="true">›</li>
            <li>
              <a href={d.catHref} className="hover:text-az-link-hover hover:underline">
                {d.catalogue.name}
              </a>
            </li>
          </>
        )}
      </ol>
    </nav>
  );
}

export async function ProductGallerySection({ productId, opts }: P & { opts?: GalleryOpts }) {
  const d = await loadProductPage(productId);
  return d ? <ProductGallery images={d.images} name={d.name} opts={opts} /> : null;
}

export async function ProductBuyBox({ productId }: P) {
  const d = await loadProductPage(productId);
  if (!d) return null;
  return (
    <ProductPurchase
      productId={Number(productId)}
      name={d.name}
      basePrice={d.purchase.price}
      stock={d.purchase.stock}
      sku={d.product.code}
      groups={d.purchase.groups}
      variants={d.purchase.variants.map(({ uuid, code, sku, price, quantity }) => ({ uuid, code, sku, price, quantity }))}
      delivery={deliveryWindow()}
      rating={d.reviews.average}
      ratingCount={d.reviews.total}
      catalogue={{ name: d.catalogue?.name ?? "Tất cả sản phẩm", href: d.catHref }}
      bullets={d.bullets}
      shopName={d.shop}
    />
  );
}

export async function ProductRelated({ productId }: P) {
  const d = await loadProductPage(productId);
  if (!d?.related.length) return null;
  return (
    <ProductRow title="Sản phẩm liên quan" href={d.catHref}>
      {d.related.map((p) => (
        <MiniCard key={p.id} product={p} />
      ))}
    </ProductRow>
  );
}

export async function ProductDescription({ productId }: P) {
  const d = await loadProductPage(productId);
  if (!d) return null;
  return (
    <section aria-labelledby="desc-h">
      <h2 id="desc-h" className="az-h2 mb-3">
        Mô tả sản phẩm
      </h2>
      <div className="az-prose max-w-4xl" dangerouslySetInnerHTML={{ __html: d.product.content || d.product.description || "" }} />
    </section>
  );
}

export async function ProductDetailsTable({ productId }: P) {
  const d = await loadProductPage(productId);
  if (!d) return null;
  return (
    <section aria-labelledby="details-h">
      <h2 id="details-h" className="az-h2 mb-3">
        Thông số sản phẩm
      </h2>
      <table className="w-full max-w-2xl text-sm">
        <tbody>
          {d.details.map(([k, v], i) => (
            <tr key={i} className="border-b border-[#e7e7e7]">
              <th scope="row" className="w-[45%] bg-[#f3f3f3] px-3 py-2 text-left font-bold">
                {k}
              </th>
              <td className="px-3 py-2">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export async function ProductReviewsSection({ productId }: P) {
  const d = await loadProductPage(productId);
  if (!d) return null;
  const { reviews, customer } = d;
  return (
    <section id="reviews" aria-labelledby="reviews-h" className="grid scroll-mt-4 gap-8 md:grid-cols-[300px_minmax(0,1fr)]">
      <div>
        <h2 id="reviews-h" className="az-h2">
          Đánh giá của khách hàng
        </h2>
        <div className="mt-2 flex items-center gap-2">
          <Stars rating={reviews.average} size={20} />
          <span className="text-lg">{reviews.total ? `${reviews.average.toFixed(1)} trên 5` : "Chưa có đánh giá"}</span>
        </div>
        <p className="mt-1 text-sm text-az-muted">
          {reviews.total.toLocaleString("vi-VN")} lượt đánh giá
        </p>
        <ul className="mt-3 space-y-2">
          {reviews.histogram.map((h) => {
            const pct = reviews.total ? Math.round((h.count / reviews.total) * 100) : 0;
            return (
              <li key={h.stars} className="flex items-center gap-2 text-sm">
                <span className="w-12 shrink-0">{h.stars} sao</span>
                <span className="h-5 flex-1 overflow-hidden rounded border border-[#e3e6e6] bg-[#f0f2f2]" role="img" aria-label={`${pct}% đánh giá ${h.stars} sao`}>
                  <span className="block h-full bg-az-star" style={{ width: `${pct}%` }} />
                </span>
                <span className="w-9 shrink-0 text-right">{pct}%</span>
              </li>
            );
          })}
        </ul>
        <hr className="my-5 border-az-border" />
        <h3 className="text-lg font-bold">Đánh giá sản phẩm này</h3>
        <p className="mb-3 text-sm">Chia sẻ cảm nhận của bạn với khách hàng khác</p>
        <ReviewForm productId={Number(productId)} reviewableType={PRODUCT_REVIEWABLE} defaultName={customer?.name ?? ""} defaultEmail={customer?.email ?? ""} />
      </div>
      <div>
        {reviews.reviews.length === 0 ? (
          <p className="text-sm text-az-muted">Chưa có đánh giá nào.</p>
        ) : (
          <ul className="space-y-6">
            {reviews.reviews.map((r) => (
              <li key={r.id}>
                <p className="flex items-center gap-2 text-[13px]">
                  <span className="flex size-8 items-center justify-center rounded-full bg-[#ddd] font-bold text-az-muted" aria-hidden="true">
                    {r.fullname.slice(0, 1).toUpperCase()}
                  </span>
                  {r.fullname}
                </p>
                <div className="mt-1">
                  <Stars rating={r.score} size={14} />
                </div>
                <p className="mt-1 text-xs text-az-muted">Đánh giá ngày {usDate(r.created_at)}</p>
                <p className="mt-2 text-sm">{r.description}</p>
                {r.image && <img src={`/${r.image.replace(/^\/+/, "")}`} alt={`Ảnh từ ${r.fullname}`} className="mt-2 h-24 w-24 rounded object-cover" loading="lazy" />}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

/* ---------------- Hop mua hang tach thanh tung widget (trinh dung giao dien) ---------------- */

type W = P & { design?: string; label?: string };

async function buyData(productId: bigint): Promise<BuyData | null> {
  const d = await loadProductPage(productId);
  if (!d) return null;
  return {
    productId: Number(productId),
    basePrice: d.purchase.price,
    stock: d.purchase.stock,
    sku: d.product.code,
    groups: d.purchase.groups,
    variants: d.purchase.variants.map(({ uuid, code, sku, price, quantity }) => ({ uuid, code, sku, price, quantity })),
  };
}

export async function ProductPriceWidget({ productId, design }: W) {
  const data = await buyData(productId);
  return data ? <BuyPrice data={data} design={design} /> : null;
}

export async function ProductOptionsWidget({ productId, design }: W) {
  const data = await buyData(productId);
  return data ? <BuyOptions data={data} design={design} /> : null;
}

export async function ProductStockWidget({ productId, design }: W) {
  const data = await buyData(productId);
  return data ? <BuyStock data={data} design={design} /> : null;
}

export async function ProductQtyWidget({ productId, design }: W) {
  const data = await buyData(productId);
  return data ? <BuyQty data={data} design={design} /> : null;
}

export async function ProductButtonWidget({ productId, design, label, buyNow }: W & { buyNow?: boolean }) {
  const data = await buyData(productId);
  return data ? <BuyButton data={data} design={design} label={label} buyNow={buyNow} /> : null;
}

export async function ProductSkuWidget({ productId }: W) {
  const data = await buyData(productId);
  return data ? <BuySku data={data} /> : null;
}

export async function ProductRatingWidget({ productId, design }: W) {
  const d = await loadProductPage(productId);
  if (!d) return null;
  const { average, total } = d.reviews;
  if (design === "compact")
    return (
      <a href="#reviews" className="inline-flex items-center gap-1 text-sm hover:underline">
        <span className="text-az-star" aria-hidden="true">
          ★
        </span>
        {total ? `${average.toFixed(1)} (${total})` : "Chưa có đánh giá"}
      </a>
    );
  if (design === "stars") return <Stars rating={average} size={18} />;
  return (
    <a href="#reviews" className="inline-flex flex-wrap items-center gap-2 text-sm hover:underline">
      {total ? (
        <>
          <span>{average.toFixed(1)}</span>
          <Stars rating={average} />
          <span className="text-az-link">{`${total.toLocaleString("vi-VN")} đánh giá`}</span>
        </>
      ) : (
        <>
          <Stars rating={0} /> <span className="text-az-link">Hãy là người đánh giá đầu tiên</span>
        </>
      )}
    </a>
  );
}

export async function ProductDeliveryWidget({ productId, design }: W) {
  const d = await loadProductPage(productId);
  if (!d) return null;
  if (design === "compact")
    return (
      <p className="text-sm">
        <span className="text-az-link">Giao hàng toàn quốc</span>
      </p>
    );
  if (design === "box")
    return (
      <div className="flex items-start gap-3 rounded-lg bg-black/[0.04] p-3 text-sm">
        <Truck className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
        <div>
          <p className="font-semibold">Giao hàng toàn quốc</p>
          <p className="opacity-75">Dự kiến {deliveryWindow()}</p>
        </div>
      </div>
    );
  return (
    <div className="text-sm">
      <p>
        <span className="text-az-link">Giao hàng toàn quốc</span> <span className="font-bold">{deliveryWindow()}</span>
      </p>
      <p className="mt-1.5 flex items-center gap-1 text-xs text-az-link">
        <MapPin className="size-3.5" aria-hidden="true" /> Giao đến toàn quốc
      </p>
    </div>
  );
}

export async function ProductShipInfoWidget({ productId, design }: W) {
  const d = await loadProductPage(productId);
  if (!d) return null;
  const rows: [string, string][] = [
    ...(STORE.shipsFrom ? ([["Gửi từ", STORE.shipsFrom]] as [string, string][]) : []),
    ["Bán bởi", d.shop],
    ["Đổi trả", "Liên hệ trong 30 ngày nếu có vấn đề"],
  ];
  if (design === "badges")
    return (
      <ul className="grid grid-cols-3 gap-2 text-center text-[11px] leading-tight">
        {[
          [Lock, "Thanh toán an toàn"],
          [Truck, STORE.shipsFrom ? `Gửi từ ${STORE.shipsFrom}` : "Giao hàng có theo dõi"],
          [RotateCcw, "Hỗ trợ 30 ngày"],
        ].map(([Icon, text], i) => {
          const I = Icon as typeof Lock;
          return (
            <li key={i} className="flex flex-col items-center gap-1.5 rounded-lg border border-current/15 p-2">
              <I className="size-5" aria-hidden="true" />
              {text as string}
            </li>
          );
        })}
      </ul>
    );
  if (design === "inline")
    return (
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs opacity-80">
        <span className="flex items-center gap-1">
          <Lock className="size-3.5" aria-hidden="true" /> Giao dịch an toàn
        </span>
        {rows.slice(0, 2).map(([k, v]) => (
          <span key={k}>
            {k} <b>{v}</b>
          </span>
        ))}
      </p>
    );
  return (
    <div>
      <p className="flex items-center gap-1 text-xs text-az-link">
        <Lock className="size-3.5" aria-hidden="true" /> Giao dịch an toàn
      </p>
      <dl className="mt-2 grid grid-cols-[80px_1fr] gap-y-1 text-xs">
        {rows.map(([k, v]) => (
          <Fragment key={k}>
            <dt className="opacity-60">{k}</dt>
            <dd>{v}</dd>
          </Fragment>
        ))}
      </dl>
    </div>
  );
}

export async function ProductBulletsWidget({ productId, design, label }: W) {
  const d = await loadProductPage(productId);
  if (!d?.bullets.length) return null;
  return (
    <section>
      {label !== "-" && <h2 className="mb-2 text-base font-bold">{label || "Thông tin sản phẩm"}</h2>}
      <ul className={design === "checks" ? "space-y-1.5 text-sm" : design === "plain" ? "space-y-2 text-sm" : "list-disc space-y-1 pl-5 text-sm"}>
        {d.bullets.map((b, i) => (
          <li key={i} className={design === "checks" ? "flex gap-2" : undefined}>
            {design === "checks" && <Check className="mt-0.5 size-4 shrink-0 text-az-success" aria-hidden="true" />}
            <span>{b}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
