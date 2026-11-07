"use client";

import { ChevronLeft, ChevronRight, ShoppingCart } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { CART_EVENT } from "@/components/site/cart-api";
import type { SliderOpts } from "./schema";

/**
 * Phan chay tren trinh duyet cua trang builder: slider, hieu ung xuat hien khi cuon, so luong gio hang.
 * Bo cuc slider (so slide moi man, khoang cach, mo dan) nam het trong CSS sinh tu schema.ts — component nay
 * chi them mui ten / cham / tu chay, nen trang render server khong bi nhay bo cuc.
 */

type Tag = "div" | "section" | "a";

export function Slider({
  as: Tag = "div",
  className,
  attrs,
  style,
  opts,
  editing,
  children,
}: {
  as?: Tag;
  className: string;
  attrs?: Record<string, string>;
  style?: React.CSSProperties;
  opts: SliderOpts;
  editing?: boolean;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  const api = useRef<{ go: (d: 1 | -1) => void; to: (i: number) => void }>({ go: () => {}, to: () => {} });
  const [pages, setPages] = useState(0);
  const [page, setPage] = useState(0);
  const [edge, setEdge] = useState({ start: true, end: false });
  const loop = opts.loop ?? true;
  const optsKey = JSON.stringify(opts);

  useEffect(() => {
    const root = ref.current;
    const track = root?.querySelector<HTMLElement>(":scope > .bb-track");
    if (!root || !track) return;
    const view = root.ownerDocument.defaultView ?? window;
    root.setAttribute("data-ready", "");
    const display = () => view.getComputedStyle(track).display;
    const active = () => display() !== "contents";
    const fade = () => display() === "grid";
    const items = () => Array.from(track.children) as HTMLElement[];
    let idx = 0;

    const setActive = (i: number) => {
      const its = items();
      if (!its.length) return;
      idx = loop ? (i + its.length) % its.length : Math.max(0, Math.min(its.length - 1, i));
      its.forEach((el, k) => (k === idx ? el.setAttribute("data-active", "") : el.removeAttribute("data-active")));
      setPages(its.length);
      setPage(idx);
      setEdge({ start: idx === 0, end: idx === its.length - 1 });
    };
    const measure = () => {
      if (!active()) return setPages(0);
      if (fade()) return setActive(idx);
      const w = track.clientWidth || 1;
      const max = track.scrollWidth - w;
      setPages(Math.max(1, Math.ceil((track.scrollWidth - 2) / w)));
      setPage(track.scrollLeft >= max - 2 ? Math.ceil((track.scrollWidth - 2) / w) - 1 : Math.round(track.scrollLeft / w));
      setEdge({ start: track.scrollLeft <= 2, end: track.scrollLeft >= max - 2 });
    };
    const go = (dir: 1 | -1) => {
      if (fade()) return setActive(idx + dir);
      const w = track.clientWidth;
      const max = track.scrollWidth - w;
      let left = track.scrollLeft + dir * w;
      if (dir > 0 && track.scrollLeft >= max - 2) left = loop ? 0 : max;
      if (dir < 0 && track.scrollLeft <= 2) left = loop ? max : 0;
      track.scrollTo({ left, behavior: "smooth" });
    };
    const to = (i: number) => (fade() ? setActive(i) : track.scrollTo({ left: i * track.clientWidth, behavior: "smooth" }));
    api.current = { go, to };

    // Editor chon mot node nam trong slide dang an -> hien slide do
    const onShow = (e: Event) => {
      const slide = (e.target as HTMLElement).closest(".bb-track > *");
      const i = slide ? items().indexOf(slide as HTMLElement) : -1;
      if (i < 0) return;
      if (fade()) setActive(i);
      else track.scrollTo({ left: (slide as HTMLElement).offsetLeft - track.offsetLeft, behavior: "smooth" });
    };

    let paused = false;
    const timer =
      opts.autoplay && !editing
        ? view.setInterval(() => {
            if (!paused && active() && !root.ownerDocument.hidden) go(1);
          }, Math.max(1500, opts.interval ?? 4000))
        : 0;
    const enter = () => (paused = opts.pauseOnHover !== false);
    const leave = () => (paused = false);
    const ro = new ResizeObserver(measure);
    ro.observe(track);
    track.addEventListener("scroll", measure, { passive: true });
    track.addEventListener("bb-show", onShow);
    root.addEventListener("pointerenter", enter);
    root.addEventListener("pointerleave", leave);
    if (fade()) setActive(0);
    measure();
    return () => {
      view.clearInterval(timer);
      ro.disconnect();
      track.removeEventListener("scroll", measure);
      track.removeEventListener("bb-show", onShow);
      root.removeEventListener("pointerenter", enter);
      root.removeEventListener("pointerleave", leave);
    };
    // optsKey: doi tuy chon trong editor thi gan lai
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [optsKey, editing, loop]);

  const dots = opts.dots ?? "below";
  const El = Tag as "div";
  return (
    <El
      ref={ref as React.Ref<HTMLDivElement>}
      className={`${className} bb-slider${dots === "inside" ? " bb-dots-inside" : ""}`}
      style={style}
      {...attrs}
    >
      <div className="bb-track">{children}</div>
      <div className="bb-nav">
        {opts.arrows !== false && pages > 1 && (
          <>
            <button type="button" className="bb-arrow bb-prev" aria-label="Previous" disabled={!loop && edge.start} onClick={() => api.current.go(-1)}>
              <ChevronLeft width={22} height={22} aria-hidden="true" />
            </button>
            <button type="button" className="bb-arrow bb-next" aria-label="Next" disabled={!loop && edge.end} onClick={() => api.current.go(1)}>
              <ChevronRight width={22} height={22} aria-hidden="true" />
            </button>
          </>
        )}
        {dots !== "none" && pages > 1 && (
          <div className="bb-dots">
            {Array.from({ length: pages }, (_, i) => (
              <button key={i} type="button" className="bb-dot" aria-label={`Slide ${i + 1}`} aria-current={i === page} onClick={() => api.current.to(i)} />
            ))}
          </div>
        )}
      </div>
    </El>
  );
}

/** Them .bb-in cho khoi co hieu ung khi cuon toi (CSS animation trong schema.ts). */
export function AnimObserver() {
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>("[data-anim]:not(.bb-in)");
    if (!("IntersectionObserver" in window)) {
      els.forEach((el) => el.classList.add("bb-in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.classList.add("bb-in");
          io.unobserve(e.target);
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return null;
}

/** Nut gio hang cua header builder: cap nhat so luong khi them vao gio (su kien CART_EVENT). */
export function CartLink({ count, className, attrs, label }: { count: number; className: string; attrs?: Record<string, string>; label?: string }) {
  const [n, setN] = useState(count);
  useEffect(() => setN(count), [count]);
  useEffect(() => {
    const on = (e: Event) => {
      const c = (e as CustomEvent<{ count?: number }>).detail?.count;
      if (typeof c === "number") setN(c);
    };
    window.addEventListener(CART_EVENT, on);
    return () => window.removeEventListener(CART_EVENT, on);
  }, []);
  return (
    <a href="/cart.html" className={`${className} bb-cart`} aria-label={`Cart, ${n} items`} {...attrs}>
      <ShoppingCart width="1.4em" height="1.4em" strokeWidth={1.75} aria-hidden="true" />
      {label && <span>{label}</span>}
      <span className="bb-cart-count">{n}</span>
    </a>
  );
}
