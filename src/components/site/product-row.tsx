"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef } from "react";

/** Hang san pham cuon ngang co mui ten trai/phai (kieu carousel cua Amazon). */
export function ProductRow({
  title,
  href,
  linkLabel = "Xem thêm",
  children,
}: {
  title: string;
  href?: string;
  linkLabel?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const scroll = (dir: 1 | -1) => {
    const el = ref.current;
    // tron mot luot (dung bang so the hien thi + gap 1rem)
    if (el) el.scrollBy({ left: dir * (el.clientWidth + 16), behavior: "smooth" });
  };
  return (
    <section className="bg-white px-4 py-4 sm:px-5" aria-label={title}>
      <div className="mb-3 flex items-baseline gap-4">
        <h2 className="text-xl font-bold">{title}</h2>
        {href && (
          <a href={href} className="az-link text-sm">
            {linkLabel}
          </a>
        )}
      </div>
      <div className="group/row relative">
        <button
          type="button"
          onClick={() => scroll(-1)}
          aria-label={`Scroll ${title} left`}
          className="absolute top-1/2 left-0 z-10 hidden h-24 w-11 -translate-y-1/2 items-center justify-center rounded-r border border-az-border bg-white/95 shadow-md sm:flex"
        >
          <ChevronLeft className="size-7" aria-hidden="true" />
        </button>
        {/* Mobile: luoi 2 cot, toi da 6 the (con lai xem qua "See more").
            Tu sm: hang cuon ngang, moi luot 4 / 6 / 8 the (sm / lg / xl), gap 1rem. */}
        <div
          ref={ref}
          className="no-scrollbar grid grid-cols-2 gap-x-3 gap-y-4 pb-1 [&>*:nth-child(n+7)]:hidden sm:flex sm:gap-4 sm:overflow-x-auto sm:scroll-smooth sm:[&>*]:w-[calc((100%-3rem)/4)] sm:[&>*]:shrink-0 sm:[&>*:nth-child(n+7)]:block lg:[&>*]:w-[calc((100%-5rem)/6)] xl:[&>*]:w-[calc((100%-7rem)/8)]"
          tabIndex={0}
          aria-label={`${title} list`}
        >
          {children}
        </div>
        <button
          type="button"
          onClick={() => scroll(1)}
          aria-label={`Scroll ${title} right`}
          className="absolute top-1/2 right-0 z-10 hidden h-24 w-11 -translate-y-1/2 items-center justify-center rounded-l border border-az-border bg-white/95 shadow-md sm:flex"
        >
          <ChevronRight className="size-7" aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}
