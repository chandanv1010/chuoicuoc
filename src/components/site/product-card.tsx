/* eslint-disable @next/next/no-img-element -- anh qua route /thumb (da thu nho, co cache) */
import { writeUrl } from "@/modules/frontend/helpers";
import { thumbUrl } from "@/modules/frontend/image";
import { STORE } from "@/modules/frontend/store";
import type { StoreProduct } from "@/modules/frontend/storefront";
import { Price } from "./price";
import { Stars } from "./stars";

export function productHref(p: { canonical: string | null }) {
  return writeUrl(p.canonical, false, true).replace(/^(?!\/|https?:)/, "/");
}

/** The ket qua tim kiem / danh muc (luoi). */
export function ProductCard({ product, delivery }: { product: StoreProduct; delivery: string }) {
  const href = productHref(product);
  return (
    <article className="group flex h-full flex-col bg-white">
      {/* Khung vuong co dinh, anh lap day (object-cover) de moi the bang nhau du anh goc khac ti le */}
      <a href={href} className="block aspect-square overflow-hidden rounded-lg bg-az-bg" tabIndex={-1} aria-hidden="true">
        <img
          src={thumbUrl(product.image, 400)}
          alt=""
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
      </a>
      <div className="flex flex-1 flex-col gap-1 px-1 pt-2 pb-3">
        <h3 className="text-[15px] leading-5">
          <a href={href} className="line-clamp-3 text-az-text hover:text-az-link-hover">
            {product.name}
          </a>
        </h3>
        <RatingLine rating={product.rating} reviews={product.reviews} href={`${href}#reviews`} />
        <a href={href} className="mt-1 text-az-text hover:text-az-link-hover">
          {Number(product.price) > 0 ? <Price value={product.price} /> : <span className="text-[15px] font-bold text-az-text">Liên hệ</span>}
        </a>
        <p className="text-xs text-az-muted">
          Giao hàng <span className="font-bold text-az-text">toàn quốc</span>
        </p>
        {STORE.shipsFrom && <p className="text-xs text-az-muted">Xuất xứ: {STORE.shipsFrom}</p>}
        <div className="mt-auto pt-2">
          <a href={href} className="az-btn az-btn-cart px-3 py-1 text-xs">
            Xem chi tiết
          </a>
        </div>
      </div>
    </article>
  );
}

export function RatingLine({ rating, reviews, href }: { rating: number; reviews: number; href: string }) {
  if (!reviews)
    return (
      <a href={href} className="flex items-center gap-1 text-xs text-az-link hover:text-az-link-hover">
        <Stars rating={0} size={14} />
        <span>Mới</span>
      </a>
    );
  return (
    <a href={href} className="flex items-center gap-1 text-xs text-az-link hover:text-az-link-hover">
      <span className="text-az-text">{rating.toFixed(1)}</span>
      <Stars rating={rating} size={14} />
      <span>({reviews.toLocaleString("en-US")})</span>
    </a>
  );
}

/** The nho trong ProductRow (trang chu, san pham lien quan) — do rong do ProductRow dat. */
export function MiniCard({ product }: { product: StoreProduct }) {
  const href = productHref(product);
  return (
    <a href={href} className="group block min-w-0">
      <div className="aspect-square overflow-hidden rounded-lg bg-az-bg">
        <img
          src={thumbUrl(product.image, 320)}
          alt={product.name}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
      </div>
      <p className="mt-2 line-clamp-2 text-[13px] leading-[18px] text-az-link group-hover:text-az-link-hover group-hover:underline">
        {product.name}
      </p>
      {product.reviews > 0 && (
        <span className="mt-0.5 flex items-center gap-1 text-xs text-az-link">
          <Stars rating={product.rating} size={13} /> {product.reviews}
        </span>
      )}
      <Price value={product.price} size="sm" className="mt-1 text-az-text" />
    </a>
  );
}
