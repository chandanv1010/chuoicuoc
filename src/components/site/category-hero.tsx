/* eslint-disable @next/next/no-img-element -- anh qua route /thumb */
import { ShoppingBag } from "lucide-react";
import { thumbUrl } from "@/modules/frontend/image";

/**
 * Hero trang chu: 3 the danh muc lon — tieu de dam o goc tren, anh san pham
 * lap phan duoi, nen pastel tung the. Mobile: luoi 2 cot; desktop: 3 cot.
 * Danh muc chua co anh (chua co hang) hien minh hoa + "Coming soon", khong dung anh gia.
 */
export type HeroCard = {
  title: string;
  subtitle: string;
  href: string;
  image: string | null;
  bg: string;
  cta: string;
  count: number;
};

export function CategoryHero({ cards }: { cards: HeroCard[] }) {
  return (
    // Khong co nen rieng va cung padding ngang voi khoi ben duoi (px-3 / sm:px-5) de mep thang hang
    <section aria-label="Danh mục sản phẩm" className="px-3 pt-5 sm:px-5">
      {/* Mobile: luoi 2 cot (the le cuoi trai ca hang), khong cuon ngang */}
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5">
        {cards.map((c) => (
          <li key={c.href} className="min-w-0 last:odd:col-span-2 sm:last:odd:col-span-1">
            <a
              href={c.href}
              className="group relative flex h-[250px] flex-col overflow-hidden rounded-2xl shadow-[0_1px_3px_rgba(60,45,30,0.12)] transition-shadow hover:shadow-[0_8px_24px_rgba(60,45,30,0.18)] sm:h-[400px] lg:h-[460px]"
              style={{ background: c.bg }}
            >
              <div className="relative z-10 p-3 sm:p-5 lg:p-6">
                <h2 className="font-display text-xl leading-[1.05] font-bold text-az-text sm:text-[28px] lg:text-[34px]">{c.title}</h2>
                <p className="mt-1.5 line-clamp-2 max-w-[90%] text-xs text-az-text/75 sm:mt-2 sm:line-clamp-none sm:text-sm">{c.subtitle}</p>
                <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-az-link group-hover:text-az-link-hover sm:mt-3 sm:text-sm">
                  {c.cta} <span aria-hidden="true">→</span>
                </span>
              </div>
              {c.image ? (
                <img
                  src={thumbUrl(c.image, 800)}
                  alt=""
                  className="mt-auto h-[58%] w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                />
              ) : (
                <div className="mt-auto flex h-[58%] flex-col items-center justify-center gap-3 text-az-text/40">
                  <ShoppingBag className="size-14 sm:size-24 stroke-[1.25]" aria-hidden="true" />
                  <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-semibold tracking-wide text-az-text/70 uppercase">Sắp có</span>
                </div>
              )}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
