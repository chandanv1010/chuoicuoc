/* eslint-disable @next/next/no-img-element -- anh do nguoi dung chon, qua /thumb khi la anh trong userfiles */
import { Menu, Search, UserRound, X } from "lucide-react";
import { BrandLogo } from "@/components/site/brand";
import { SITE_NAME_FALLBACK } from "@/lib/constants";
import { CategoryHero, type HeroCard } from "@/components/site/category-hero";
import { MiniCard, productHref } from "@/components/site/product-card";
import { Price } from "@/components/site/price";
import { ProductRow } from "@/components/site/product-row";
import { Stars } from "@/components/site/stars";
import { thumbUrl } from "@/modules/frontend/image";
import type { StoreProduct } from "@/modules/frontend/storefront";
import { AnimObserver, CartLink, Slider } from "./client";
import { BuilderIcon } from "./icons";
import { hasSlider, isContainer, isProducts, PAGE_KIND_LABEL, SLOTS, toCss, type Anim, type BlockData, type BuilderDoc, type BuilderNode, type ItemOverride } from "./schema";

/**
 * Ve cay builder thanh HTML that cua storefront. Dung chung cho trang that (server) va canvas cua editor
 * (client, `editing` = true: gan data-node-id de chon / keo tha, hien o trong cho container rong, khong tu chay
 * slider). The mau trong "Danh sách dữ liệu" va khung gan ban ghi nhan `item` de thay {{truong}}.
 */

export type SiteCtx = { cartCount: number; customer: string | null };
export type Item = Record<string, string>;
export type NavLink = { name: string; href: string; children?: { name: string; href: string }[] };

type Ctx = { doc: BuilderDoc; data: BlockData; editing: boolean; site: SiteCtx; slots: Record<string, React.ReactNode> };

/**
 * `slots`: khoi trang da ve san (slots.tsx, server) theo id node. Template trang con: ban ghi dang xem nam o
 * data["__record"] va duoc truyen xuong tu goc ({{name}}... dung o moi cho).
 */
export function BuilderTree({
  doc,
  data,
  editing = false,
  site,
  slots,
}: {
  doc: BuilderDoc;
  data: BlockData;
  editing?: boolean;
  site?: SiteCtx;
  slots?: Record<string, React.ReactNode>;
}) {
  const c: Ctx = { doc, data, editing, site: site ?? { cartCount: 0, customer: null }, slots: slots ?? {} };
  const record = (data.__record as Item | null | undefined) ?? undefined;
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: toCss(doc) }} />
      {!editing && (
        <noscript>
          <style>{"[data-anim]{opacity:1!important}"}</style>
        </noscript>
      )}
      <NodeView id={doc.root} c={c} item={record} />
      {!editing && <AnimObserver />}
    </>
  );
}

/** Thay {{truong}} bang du lieu; trong editor chua co du lieu thi de nguyen de nguoi dung thay cho chen. */
function fill(s: string | undefined, item: Item | undefined, editing: boolean) {
  if (!s || !s.includes("{{")) return s ?? "";
  return s.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k: string) => item?.[k] ?? (editing ? m : ""));
}

function animAttrs(a: Anim | undefined): { attrs: Record<string, string>; style: React.CSSProperties } {
  if (!a || a.type === "none") return { attrs: {}, style: {} };
  return {
    attrs: { "data-anim": a.type },
    style: {
      ["--bb-anim" as string]: `bb-${a.type}`,
      ["--bb-dur" as string]: `${a.duration ?? 700}ms`,
      ["--bb-delay" as string]: `${a.delay ?? 0}ms`,
    },
  };
}

/** Hieu ung "lan luot": khoi cha chia cho tung con, moi con tre them `stagger` ms. */
function staggered(a: Anim | undefined, i: number): Anim | undefined {
  return a?.stagger && a.type !== "none" ? { ...a, delay: (a.delay ?? 0) + i * a.stagger } : undefined;
}

const SAMPLE: Item = {};

/**
 * `card`: dang ve ben trong the thu `index` cua "Danh sách dữ liệu" — `over` la ghi de rieng cua the do
 * (theo id node). Editor gan data-copy de bam vao the nao thi chon dung node trong the do.
 */
type Card = { index: number; over?: Record<string, ItemOverride> };

function NodeView({ id, c, item, anim, card }: { id: string; c: Ctx; item?: Item; anim?: Anim; card?: Card }) {
  const base = c.doc.nodes[id];
  if (!base) return null;
  const ovProps = card?.over?.[id]?.props;
  const n = ovProps ? { ...base, props: { ...base.props, ...ovProps } } : base;
  const { editing } = c;
  const className = `b-${id}`;
  const nodeAttrs: Record<string, string> = editing ? { "data-node-id": id, ...(card ? { "data-copy": String(card.index) } : {}) } : {};
  const own = n.props.anim?.stagger ? undefined : n.props.anim;
  const a = animAttrs(own && own.type !== "none" ? own : anim);
  const attrs = { ...nodeAttrs, ...a.attrs };
  const style = { ...a.style } as React.CSSProperties;
  const empty = (label: string) => (editing ? <div className="bb-placeholder">{label}</div> : null);

  // Khung gan voi mot ban ghi cu the: con dung du lieu cua ban ghi nay
  const bound = n.props.bind ? ((c.data[id] as Item | undefined) ?? (editing ? SAMPLE : undefined)) : undefined;
  const ctxItem = bound ?? item;
  if (ctxItem && n.props.bindBg && ctxItem.bg) style.backgroundColor = ctxItem.bg;
  if (ctxItem && n.props.bindBgImage) {
    // Anh nen tu du lieu + lop toi phia duoi de chu trang de doc; ban ghi khong co anh -> nen toi du phong
    style.backgroundImage = ctxItem.image
      ? `linear-gradient(180deg, rgba(0,0,0,0) 35%, rgba(0,0,0,.62)), url("${thumbUrl(ctxItem.image, 900)}")`
      : "linear-gradient(160deg, #57534a, #2a2925)";
    style.backgroundSize = "cover";
    style.backgroundPosition = "center";
  }

  if (isContainer(n)) {
    const kids = n.children ?? [];
    const href = n.props.href ? fill(n.props.href, ctxItem, editing) : "";
    const Tag = href ? "a" : n.type === "section" ? "section" : "div";
    const linkAttrs = href ? { href, ...(n.props.newTab ? { target: "_blank", rel: "noopener" } : {}) } : {};
    const children = kids.map((k, i) => <NodeView key={k} id={k} c={c} item={ctxItem} anim={staggered(n.props.anim, i)} card={card} />);
    if (hasSlider(n))
      return (
        <Slider as={Tag} className={className} attrs={{ ...attrs, ...linkAttrs }} style={style} opts={n.props.slider ?? {}} editing={editing}>
          {children}
        </Slider>
      );
    return (
      <Tag className={className} style={style} {...attrs} {...linkAttrs} {...(editing && !kids.length ? { "data-empty": "" } : {})}>
        {children}
      </Tag>
    );
  }

  switch (n.type) {
    case "collection": {
      const template = n.children?.[0];
      const items = (c.data[id] as Item[] | undefined) ?? [];
      if (!template) return <div className={className} {...attrs} style={style}>{empty("Thêm một Frame vào đây làm thẻ mẫu")}</div>;
      const list = items.length ? items : editing ? [SAMPLE] : [];
      const cards = list.map((it, i) => (
        <NodeView key={i} id={template} c={c} item={it} anim={staggered(n.props.anim, i)} card={{ index: i, over: n.props.perItem?.[i] }} />
      ));
      if (hasSlider(n))
        return (
          <Slider className={className} attrs={attrs} style={style} opts={n.props.slider ?? {}} editing={editing}>
            {cards}
          </Slider>
        );
      return (
        <div className={className} {...attrs} style={style}>
          {cards}
        </div>
      );
    }
    case "text": {
      const Tag = n.props.tag ?? "p";
      return (
        <Tag className={className} {...attrs} style={style}>
          {fill(n.props.text, ctxItem, editing)}
        </Tag>
      );
    }
    case "image": {
      // Ban ghi that khong co anh -> anh trong trung tinh (giu bo cuc the); chua co du lieu (editor) -> o huong dan
      const src = n.props.bindImage ? (ctxItem && ctxItem !== SAMPLE ? thumbUrl(ctxItem.image, 900) : "") : n.props.src;
      return src ? (
        <img className={className} {...attrs} style={style} src={src} alt={fill(n.props.alt, ctxItem, editing) || ctxItem?.name || ""} loading="lazy" decoding="async" />
      ) : (
        <div className={className} {...attrs} style={style}>
          {empty(n.props.bindImage ? "Ảnh lấy từ dữ liệu ({{image}})" : "Chưa chọn ảnh")}
        </div>
      );
    }
    case "button":
      return (
        <a
          className={`${className} bb-btn`}
          {...attrs}
          style={style}
          href={fill(n.props.href, ctxItem, editing) || "#"}
          {...(n.props.newTab ? { target: "_blank", rel: "noopener" } : {})}
        >
          {fill(n.props.label, ctxItem, editing) || "Button"}
        </a>
      );
    case "divider":
      return <hr className={className} {...attrs} style={style} />;
    case "icon":
      return (
        <span className={className} {...attrs} style={style}>
          <BuilderIcon name={n.props.icon} />
        </span>
      );
    case "video":
      return <VideoView n={n} className={className} attrs={attrs} style={style} editing={editing} />;
    case "logo":
      return (
        <a href="/" className={className} {...attrs} style={style} aria-label="Home">
          {n.props.src ? (
            <img src={n.props.src} alt={n.props.alt || "Logo"} className="block h-auto max-h-full w-full object-contain" />
          ) : (
            <BrandLogo name={typeof c.data.__site_name === "string" ? c.data.__site_name : SITE_NAME_FALLBACK} tone={n.props.tone ?? "light"} />
          )}
        </a>
      );
    case "search":
      return (
        <form action="/products.html" method="get" role="search" className={`${className} bb-search`} {...attrs} style={style}>
          <input type="search" name="keyword" placeholder={n.props.placeholder || "Search"} aria-label="Search" />
          <button type="submit" aria-label="Search">
            <Search width={20} height={20} aria-hidden="true" />
          </button>
        </form>
      );
    case "cart":
      return <CartLink count={c.site.cartCount} className={className} attrs={{ ...attrs }} label={n.props.label} />;
    case "account":
      return (
        <a href={c.site.customer ? "/account.html" : "/login.html"} className={`${className} bb-account`} {...attrs} style={style}>
          <UserRound width="1.3em" height="1.3em" strokeWidth={1.75} aria-hidden="true" />
          <span>{c.site.customer ? `Hi, ${c.site.customer.split(/\s+/)[0]}` : n.props.label || "Sign in"}</span>
        </a>
      );
    case "nav":
      return <NavView n={n} links={(c.data[id] as NavLink[] | undefined) ?? []} className={className} attrs={attrs} style={style} />;
    case "productRow":
    case "productGrid": {
      const items = (c.data[id] as StoreProduct[] | undefined) ?? [];
      if (!isProducts(n)) {
        // Hang kieu Amazon co san (mac dinh cua productRow)
        if (!items.length)
          return editing ? (
            <div className={className} {...attrs} style={style}>
              {empty(`${n.props.title || "Khối sản phẩm"}: không có sản phẩm — đổi nguồn dữ liệu`)}
            </div>
          ) : null;
        return (
          <div className={className} {...attrs} style={style}>
            <ProductRow title={n.props.title ?? ""} href={n.props.href || undefined} linkLabel={n.props.linkLabel || "See more"}>
              {items.map((p) => (
                <MiniCard key={p.id} product={p} />
              ))}
            </ProductRow>
          </div>
        );
      }
      const cards = items.map((p, i) => <ProductCardView key={p.id} p={p} n={n} anim={staggered(n.props.anim, i)} />);
      return (
        <div className={className} {...attrs} style={style}>
          {(n.props.title || n.props.href) && (
            <div className="bb-phead" data-align={n.props.titleAlign ?? "left"}>
              {n.props.title && <h2 className="bb-ptitle">{n.props.title}</h2>}
              {n.props.href && (
                <a href={n.props.href} className="az-link text-sm">
                  {n.props.linkLabel || "See more"}
                </a>
              )}
            </div>
          )}
          {!items.length ? (
            empty("Không có sản phẩm — đổi nguồn dữ liệu")
          ) : hasSlider(n) ? (
            <Slider className="bb-items" opts={n.props.slider ?? {}} editing={editing}>
              {cards}
            </Slider>
          ) : (
            <div className="bb-items">{cards}</div>
          )}
        </div>
      );
    }
    case "slot": {
      const def = n.props.slot ? SLOTS[n.props.slot] : undefined;
      const el = c.slots[id];
      return (
        <div className={className} {...attrs} style={style}>
          {el ?? empty(def ? `${def.label} — chỉ hiện trong template “${def.kinds.map((k) => PAGE_KIND_LABEL[k]).join(" / ")}”` : "Khối trang")}
        </div>
      );
    }
    case "categoryHero": {
      const cards = (c.data[id] as HeroCard[] | undefined) ?? [];
      return (
        <div className={className} {...attrs} style={style}>
          <CategoryHero cards={cards} />
        </div>
      );
    }
    default:
      return null;
  }
}

/** The san pham cua khoi tu chon bo cuc: ti le anh, kieu khung, an / hien danh gia va gia. */
function ProductCardView({ p, n, anim }: { p: StoreProduct; n: BuilderNode; anim?: Anim }) {
  const boxed = n.props.cardStyle === "boxed";
  const a = animAttrs(anim);
  return (
    <a
      href={productHref(p)}
      {...a.attrs}
      style={a.style}
      className={`group block min-w-0 ${boxed ? "rounded-xl bg-white p-2.5 shadow-[0_1px_3px_rgba(60,45,30,.12)] transition-shadow hover:shadow-[0_8px_24px_rgba(60,45,30,.16)]" : ""}`}
    >
      <div className="overflow-hidden rounded-lg bg-az-bg" style={{ aspectRatio: n.props.cardRatio ?? "1 / 1" }}>
        <img
          src={thumbUrl(p.image, 480)}
          alt={p.name}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
        />
      </div>
      <p className="mt-2 line-clamp-2 text-[13px] leading-[18px] text-az-link group-hover:text-az-link-hover group-hover:underline">{p.name}</p>
      {n.props.showRating !== false && p.reviews > 0 && (
        <span className="mt-0.5 flex items-center gap-1 text-xs text-az-link">
          <Stars rating={p.rating} size={13} /> {p.reviews}
        </span>
      )}
      {n.props.showPrice !== false && <Price value={p.price} size="sm" className="mt-1 text-az-text" />}
    </a>
  );
}

function VideoView({ n, className, attrs, style, editing }: { n: BuilderNode; className: string; attrs: Record<string, string>; style: React.CSSProperties; editing: boolean }) {
  const url = n.props.url ?? "";
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/)?.[1];
  const vimeo = url.match(/vimeo\.com\/(?:video\/)?(\d+)/)?.[1];
  const src = yt ? `https://www.youtube-nocookie.com/embed/${yt}` : vimeo ? `https://player.vimeo.com/video/${vimeo}` : "";
  if (src)
    return (
      <div className={className} {...attrs} style={style}>
        <iframe src={src} title={n.props.alt || "Video"} className="h-full w-full border-0" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen loading="lazy" />
      </div>
    );
  if (/\.(mp4|webm|mov)(\?|$)/i.test(url))
    return (
      <div className={className} {...attrs} style={style}>
        <video src={url} className="h-full w-full object-cover" controls playsInline preload="metadata" />
      </div>
    );
  return (
    <div className={className} {...attrs} style={style}>
      {editing && <div className="bb-placeholder">Dán link YouTube / Vimeo / .mp4</div>}
    </div>
  );
}

/** Menu: lien ket tu nhap + danh muc (co menu con khi re chuot); thu thanh nut ☰ mo ngan keo o man nho (khong can JS). */
function NavView({ n, links, className, attrs, style }: { n: BuilderNode; links: NavLink[]; className: string; attrs: Record<string, string>; style: React.CSSProperties }) {
  const toggle = `bb-nav-${n.id}`;
  const collapse = n.props.collapse ?? "mobile";
  return (
    <nav className={`${className} bb-collapse-${collapse}`} {...attrs} style={style} aria-label="Main">
      <input type="checkbox" id={toggle} className="bb-navtoggle" />
      <label htmlFor={toggle} className="bb-burger" aria-label="Menu">
        <Menu width={24} height={24} aria-hidden="true" />
      </label>
      <label htmlFor={toggle} className="bb-navclose" aria-label="Close menu">
        <X className="hidden" />
      </label>
      <ul className="bb-navlist">
        {links.map((l, i) => (
          <li key={i} className="bb-navitem">
            <a href={l.href}>{l.name}</a>
            {!!l.children?.length && (
              <ul className="bb-sub">
                {l.children.map((k, j) => (
                  <li key={j}>
                    <a href={k.href}>{k.name}</a>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}
