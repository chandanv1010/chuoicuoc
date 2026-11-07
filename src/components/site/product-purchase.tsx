"use client";

import { Lock, Phone } from "lucide-react";
import { useMemo } from "react";
import { formatPrice } from "@/modules/frontend/money";
import { STORE } from "@/modules/frontend/store";
import { swatchColor } from "@/modules/frontend/swatch";
import { useBuy, type BuyGroup, type BuyVariant } from "./buy-state";
import { Price } from "./price";
import { Stars } from "./stars";

/**
 * Cot giua (gia + chon bien the) va hop "lien he" ben phai cua trang chi tiet.
 * Chuc nang gio hang da tat cho site nay (catalog): khong co nut them gio / mua ngay,
 * thay bang nut "Lien he dat hang".
 */
type Group = BuyGroup;
type Variant = BuyVariant;

export function ProductPurchase({
  productId,
  name,
  basePrice,
  stock,
  sku,
  groups,
  variants,
  delivery,
  rating,
  ratingCount,
  catalogue,
  bullets,
  shopName,
}: {
  productId: number;
  name: string;
  basePrice: number;
  stock: number;
  sku: string | null;
  groups: Group[];
  variants: Variant[];
  delivery: string;
  rating: number;
  ratingCount: number;
  catalogue: { name: string; href: string };
  bullets: string[];
  /** Ten shop (siteName() o server cha) */
  shopName: string;
}) {
  const data = useMemo(() => ({ productId, basePrice, stock, sku, groups, variants }), [productId, basePrice, stock, sku, groups, variants]);
  const buy = useBuy(data);
  const { selected, pick, possible, variant, price, available, priceRange, selectedNames } = buy;

  const isSwatch = (g: Group) => /colou?r/i.test(g.name);
  const hasPrice = Number(price) > 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_244px] lg:grid-rows-[auto_1fr]">
      {/* Cot giua */}
      <div className="min-w-0 lg:col-start-1 lg:row-start-1">
        <h1 className="text-xl leading-7 font-normal sm:text-2xl sm:leading-8">{name}</h1>
        <a href="/products.html" className="az-link text-sm">
          Xem cửa hàng {shopName}
        </a>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
          {ratingCount > 0 ? (
            <a href="#reviews" className="az-link flex items-center gap-2">
              <span className="text-az-text">{rating.toFixed(1)}</span>
              <Stars rating={rating} />
              {`${ratingCount.toLocaleString("vi-VN")} đánh giá`}
            </a>
          ) : (
            <a href="#reviews" className="az-link flex items-center gap-2">
              <Stars rating={0} /> Hãy là người đánh giá đầu tiên
            </a>
          )}
          <span className="text-az-border" aria-hidden="true">
            |
          </span>
          <a href={catalogue.href} className="az-link">
            {catalogue.name}
          </a>
        </div>
        <hr className="my-3 border-az-border" />
        <div>
          {hasPrice ? <Price value={price} size="xl" /> : <span className="text-[28px] font-semibold text-az-text">Liên hệ</span>}
          {priceRange && !variant ? (
            <p className="mt-1 text-sm text-az-muted">
              Tùy chọn từ {formatPrice(priceRange[0])} đến {formatPrice(priceRange[1])}
            </p>
          ) : null}
          <p className="mt-1 text-sm">
            <span className="text-az-link">Giao hàng toàn quốc</span>
          </p>
        </div>

        {groups.map((g) => {
          const cur = g.options.find((o) => o.id === selected[g.id]);
          return (
            <fieldset key={g.id} className="mt-4">
              <legend className="mb-1.5 text-sm">
                {g.name}: <span className="font-bold">{cur?.name ?? "Chọn"}</span>
              </legend>
              <div className="flex flex-wrap gap-2">
                {g.options.map((o) => {
                  const on = selected[g.id] === o.id;
                  const ok = possible(g.id, o.id);
                  return (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => pick(g.id, o.id)}
                      aria-pressed={on}
                      title={ok ? o.name : `${o.name} – không khả dụng với lựa chọn hiện tại`}
                      className={`relative min-h-9 rounded-lg border px-3 py-1.5 text-left text-[13px] leading-4 ${
                        on ? "border-az-link bg-[#edfdff] shadow-[0_0_0_1px_#007185]" : "border-[#bbbfbf] bg-white hover:bg-[#f7fafa]"
                      } ${ok ? "" : "border-dashed text-az-muted"}`}
                    >
                      {isSwatch(g) ? (
                        <span className="flex items-center gap-2">
                          <span className="size-4 rounded-full border border-black/20" style={{ background: swatchColor(o.name) }} aria-hidden="true" />
                          {o.name}
                        </span>
                      ) : (
                        o.name
                      )}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          );
        })}

        {(variant?.sku || sku) && (
          <p className="mt-3 text-xs text-az-muted">
            Mã SP: <span>{variant?.sku ?? sku}</span>
          </p>
        )}
      </div>

      {bullets.length > 0 && (
        <div className="min-w-0 max-lg:order-2 lg:col-start-1 lg:row-start-2">
          <section aria-labelledby="about-item" className="border-t border-az-border pt-4">
            <h2 id="about-item" className="mb-2 text-base font-bold">
              Thông tin sản phẩm
            </h2>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {bullets.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          </section>
        </div>
      )}

      {/* Hop lien he (thay hop mua hang) */}
      <aside
        aria-label="Đặt hàng"
        className="h-fit rounded-lg border border-az-border p-4 max-lg:order-1 lg:sticky lg:top-2 lg:col-start-2 lg:row-span-2 lg:row-start-1"
      >
        <div className="hidden lg:block">
          {hasPrice ? <Price value={price} size="lg" /> : <span className="text-2xl font-semibold text-az-text">Liên hệ</span>}
        </div>
        <p className="mt-2 text-sm">
          <span className="text-az-link">Giao hàng toàn quốc</span>
        </p>
        <p className={`mt-3 text-lg ${available ? "text-az-success" : "text-az-deal"}`}>
          {available ? "Còn hàng" : "Liên hệ để biết tình trạng hàng"}
        </p>
        {selectedNames.length > 0 && <p className="mt-1 text-xs text-az-muted">{selectedNames.join(" / ")}</p>}

        <div className="mt-4 space-y-2">
          <a href="/contact.html" className="az-btn az-btn-cart flex w-full items-center justify-center gap-2 py-2">
            <Phone className="size-4" aria-hidden="true" /> Liên hệ đặt hàng
          </a>
        </div>

        <p className="mt-4 flex items-center gap-1 text-xs text-az-link">
          <Lock className="size-3.5" aria-hidden="true" /> Tư vấn &amp; báo giá miễn phí
        </p>
        <dl className="mt-2 grid grid-cols-[80px_1fr] gap-y-1 text-xs">
          {STORE.shipsFrom && (
            <>
              <dt className="text-az-muted">Xuất xứ</dt>
              <dd>{STORE.shipsFrom}</dd>
            </>
          )}
          <dt className="text-az-muted">Bán bởi</dt>
          <dd>{shopName}</dd>
          <dt className="text-az-muted">Đổi trả</dt>
          <dd>Liên hệ trong 30 ngày nếu có vấn đề</dd>
        </dl>
      </aside>
    </div>
  );
}
