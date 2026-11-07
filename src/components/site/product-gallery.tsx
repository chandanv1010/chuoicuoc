"use client";

/* eslint-disable @next/next/no-img-element -- anh qua route /thumb */
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { thumbUrl } from "@/modules/frontend/image";

export type GalleryOpts = {
  /** vi tri dai anh nho: trai / phai (doc), duoi / tren (ngang), none = an, chuyen anh bang mui ten + cham */
  thumbs?: "left" | "right" | "bottom" | "top" | "none";
  /** so anh nho hien cung luc (con lai cuon) */
  visible?: number;
  /** canh anh nho (px) */
  size?: number;
  /** phong to theo con tro khi re chuot */
  zoom?: boolean;
};

/**
 * Thu vien anh trang chi tiet kieu Amazon: dai thumbnail (mac dinh doc ben trai, di chuot / bam de doi anh), anh
 * chinh phong to theo con tro khi re chuot. Mobile: dai doc chuyen thanh ngang. Trinh dung giao dien chon vi tri dai
 * anh nho, so anh hien, co phong to hay khong (GalleryOpts).
 */
export function ProductGallery({ images, name, opts = {} }: { images: string[]; name: string; opts?: GalleryOpts }) {
  const [active, setActive] = useState(0);
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
  const list = images.length ? images : [""];
  const current = list[Math.min(active, list.length - 1)];
  const pos = opts.thumbs ?? "left";
  const zoomable = opts.zoom !== false;
  const size = Math.max(32, Math.min(120, opts.size ?? 52));
  const gap = 8;
  const visible = Math.max(1, Math.min(20, opts.visible ?? 0));
  // Gioi han dai anh nho theo so anh hien; 0 = theo chieu cao / rong cua anh chinh
  const span = opts.visible ? visible * size + (visible - 1) * gap : null;
  const vertical = pos === "left" || pos === "right";

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!zoomable) return;
    const r = e.currentTarget.getBoundingClientRect();
    setZoom({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
  };
  const go = (d: number) => setActive((a) => (a + d + list.length) % list.length);

  const layout = {
    left: "flex-col-reverse md:flex-row",
    right: "flex-col-reverse md:flex-row-reverse",
    bottom: "flex-col-reverse",
    top: "flex-col",
    none: "flex-col",
  }[pos];

  return (
    <div className={`flex gap-3 md:sticky md:top-2 ${layout}`}>
      {list.length > 1 && pos !== "none" && (
        <ul
          className={`no-scrollbar flex gap-2 overflow-x-auto ${vertical ? "md:max-h-[var(--g-span,520px)] md:flex-col md:overflow-x-visible md:overflow-y-auto" : ""} ${vertical ? "max-w-full" : ""}`}
          style={
            {
              "--g-span": span ? `${span}px` : undefined,
              ...(vertical ? {} : span ? { maxWidth: span } : {}),
            } as React.CSSProperties
          }
          aria-label="Product images"
        >
          {list.map((src, i) => (
            <li key={i} className="shrink-0">
              <button
                type="button"
                onClick={() => setActive(i)}
                onMouseEnter={() => setActive(i)}
                aria-label={`Show image ${i + 1} of ${list.length}`}
                aria-current={i === active ? "true" : undefined}
                style={{ width: size, height: size }}
                className={`block overflow-hidden rounded-lg border bg-white p-0.5 ${i === active ? "border-az-link shadow-[0_0_3px_2px_rgba(228,121,17,0.5)]" : "border-[#a2a6ac] hover:border-az-link"}`}
              >
                <img src={thumbUrl(src, size > 60 ? 200 : 100)} alt="" className="h-full w-full object-contain" loading="lazy" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div
        className={`relative aspect-square w-full flex-1 overflow-hidden bg-white ${zoomable ? "cursor-zoom-in" : ""}`}
        onMouseMove={onMove}
        onMouseLeave={() => setZoom(null)}
      >
        <img
          src={thumbUrl(current, 900)}
          alt={`${name}${list.length > 1 ? ` – image ${active + 1}` : ""}`}
          className="h-full w-full object-contain transition-transform duration-100"
          style={zoom ? { transform: "scale(2.2)", transformOrigin: `${zoom.x}% ${zoom.y}%` } : undefined}
          fetchPriority={active === 0 ? "high" : undefined}
        />
        {zoomable && (
          <p className="pointer-events-none absolute right-0 bottom-1 left-0 hidden text-center text-xs text-az-muted md:block">{zoom ? "" : "Di chuột để phóng to"}</p>
        )}
        {pos === "none" && list.length > 1 && (
          <>
            <button type="button" onClick={() => go(-1)} aria-label="Ảnh trước" className="absolute top-1/2 left-2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-white/90 shadow">
              <ChevronLeft className="size-5" aria-hidden="true" />
            </button>
            <button type="button" onClick={() => go(1)} aria-label="Ảnh sau" className="absolute top-1/2 right-2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-white/90 shadow">
              <ChevronRight className="size-5" aria-hidden="true" />
            </button>
            <div className="absolute bottom-3 left-0 flex w-full justify-center gap-1.5">
              {list.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setActive(i)}
                  aria-label={`Show image ${i + 1}`}
                  className={`size-2 rounded-full ${i === active ? "bg-az-text" : "bg-black/25"}`}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
