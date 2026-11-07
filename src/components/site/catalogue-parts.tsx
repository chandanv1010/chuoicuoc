import { Check, ChevronDown, ChevronLeft, X } from "lucide-react";
import { cache, type ReactNode } from "react";
import { getSystem } from "@/lib/language";
import { siteName } from "@/lib/site";
import { FRONTEND_LANGUAGE } from "@/modules/frontend/core";
import { plainText, seo, writeUrl, type Seo } from "@/modules/frontend/helpers";
import { getCatalogueTree, getProductCatalogueById, type CatNode } from "@/modules/frontend/product";
import { getColorFacets, PRICE_RANGES, readFilters, searchProducts, SORTS } from "@/modules/frontend/storefront";
import { swatchColor } from "@/modules/frontend/swatch";
import { NavSelect } from "./nav-select";
import { Pager } from "./pager";
import { SortSelect } from "./sort-select";
import { Stars } from "./stars";

/**
 * Cac phan cua trang danh muc / tat ca san pham / ket qua tim kiem: tung bo loc (danh muc, gia, mau, danh gia),
 * so ket qua, sap xep, phan trang. Trang code cung (product-catalogue-view.tsx) ghep lai nhu cu; template cua
 * trinh dung giao dien dat tung phan nhu mot widget. Du lieu nap mot lan moi request (cache).
 */
export const PER_PAGE = 16;

export type ListingArgs = { catalogueId: bigint | null; page: number; query: [string, string][] };

const load = cache(async (catalogueId: string | null, page: number, queryJson: string) => {
  const language = FRONTEND_LANGUAGE;
  const query = JSON.parse(queryJson) as [string, string][];
  const q = query.filter(([k]) => k !== "page");
  const [system, shop] = await Promise.all([getSystem(), siteName()]);
  let pageSeo: Seo;
  let title: string;
  let description = "";
  let base: string;
  let currentCat: number | null = null;
  if (catalogueId !== null) {
    const pc = await getProductCatalogueById(BigInt(catalogueId), language);
    if (!pc) return null;
    pageSeo = seo(pc, page);
    title = pc.name;
    description = plainText(pc.description);
    base = `/${pc.canonical}`;
    currentCat = Number(pc.id);
  } else {
    pageSeo = {
      meta_title: `All Products – ${shop}`,
      meta_keyword: system.seo_meta_keyword ?? "",
      meta_description: system.seo_meta_description ?? "",
      meta_image: system.seo_meta_images ?? "",
      canonical: writeUrl("products"),
    };
    title = "All Products";
    base = "/products";
  }
  const filters = readFilters(q, currentCat);
  const [tree, colors, result] = await Promise.all([getCatalogueTree(language), getColorFacets(), searchProducts(filters, page, PER_PAGE)]);
  if (filters.keyword) pageSeo = { ...pageSeo, meta_title: `${filters.keyword} – Kết quả tìm kiếm | ${shop}` };
  const lastPage = Math.max(1, Math.ceil(result.total / PER_PAGE));
  return {
    pageSeo,
    title,
    description,
    base,
    q,
    page,
    filters,
    tree,
    colors,
    result,
    lastPage,
    from: result.total ? (page - 1) * PER_PAGE + 1 : 0,
    to: Math.min(page * PER_PAGE, result.total),
    selectedCatName: flatten(tree).find((c) => Number(c.id) === filters.catalogueId)?.name,
    anyFilter: !!(filters.price || filters.priceMin !== null || filters.priceMax !== null || filters.color || filters.rating),
  };
});

export function loadCatalogueListing({ catalogueId, page, query }: ListingArgs) {
  return load(catalogueId === null ? null : String(catalogueId), page, JSON.stringify(query));
}

type L = NonNullable<Awaited<ReturnType<typeof load>>>;

/** URL voi tham so moi (xoa trang). key = null -> bo tham so. */
function withParams(d: L, changes: Record<string, string | null>, path = `${d.base}.html`) {
  const params = new URLSearchParams(d.q.filter(([k]) => !(k in changes)));
  for (const [k, v] of Object.entries(changes)) if (v !== null && v !== "") params.set(k, v);
  const s = params.toString();
  return s ? `${path}?${s}` : path;
}

/** Tuy chon hien thi chung cua widget bo loc (trinh dung giao dien): kieu, doi / an tieu de, thu gon. */
export type FilterOpts = { design?: string; heading?: string; hideHeading?: boolean; collapsible?: boolean };

function Heading({ text }: { text: string }) {
  return (
    <h2 className="mb-3 text-[11px] font-semibold tracking-[0.18em] text-az-muted uppercase">
      {text}
      <span className="stitch mt-1.5 block h-[2px] w-10 text-az-cart" aria-hidden="true" />
    </h2>
  );
}

/** Tieu de (doi chu / an) + tuy chon thu gon bang <details>. */
function Shell({ o, title, children }: { o: FilterOpts; title: string; children: ReactNode }) {
  const text = o.heading || title;
  if (o.collapsible)
    return (
      <details open className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between text-[11px] font-semibold tracking-[0.18em] text-az-muted uppercase [&::-webkit-details-marker]:hidden">
          {text}
          <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden="true" />
        </summary>
        <div className="mt-3">{children}</div>
      </details>
    );
  return (
    <section>
      {!o.hideHeading && <Heading text={text} />}
      {children}
    </section>
  );
}

// Lua chon dang "chip" bo tron; dang chon thi nen xanh reu chu trang
const chipCls = (active: boolean) =>
  `inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[13px] transition-colors ${
    active ? "border-az-header bg-az-header text-white" : "border-az-border bg-white text-az-text hover:border-az-link hover:text-az-link"
  }`;
// Dong danh sach co o chon (tron / vuong) ben trai
const rowCls = (active: boolean) => `flex items-center gap-2 rounded-md px-1.5 py-1 text-[13px] ${active ? "font-semibold" : "hover:bg-az-bg"}`;
const Radio = ({ on }: { on: boolean }) => <span className={`size-4 shrink-0 rounded-full ${on ? "border-[5px] border-az-cart" : "border-2 border-az-border"}`} aria-hidden="true" />;
const Box = ({ on }: { on: boolean }) => (
  <span className={`flex size-4 shrink-0 items-center justify-center rounded border ${on ? "border-az-cart bg-az-cart text-white" : "border-az-border bg-white"}`} aria-hidden="true">
    {on && <Check className="size-3" />}
  </span>
);
// O vuong trong luoi 2 cot
const tileCls = (active: boolean) =>
  `flex h-full items-center justify-center rounded-lg border px-2 py-2.5 text-center text-[13px] ${active ? "border-az-cart bg-az-cart/10 font-semibold" : "border-az-border bg-white hover:border-az-link"}`;

function catHref(node: CatNode, keyword: string) {
  // Dang tim kiem: giu tu khoa, loc theo danh muc; khong thi sang trang danh muc
  return keyword ? `/products.html?keyword=${encodeURIComponent(keyword)}&product_catalogue_id=${node.id}` : `/${node.canonical}.html`;
}

export async function FilterCategories(a: ListingArgs & FilterOpts) {
  const d = await loadCatalogueListing(a);
  if (!d) return null;
  const { filters } = d;
  const all = filters.keyword ? `/products.html?keyword=${encodeURIComponent(filters.keyword)}` : "/products.html";
  const flat = flatten(d.tree);
  const active = (c: CatNode) => Number(c.id) === filters.catalogueId;
  const href = (c: CatNode) => catHref(c, filters.keyword);
  let body: ReactNode;
  switch (a.design) {
    case "dropdown": {
      const cur = flat.find(active);
      body = <NavSelect label="Danh mục" value={cur ? href(cur) : all} options={[{ label: "Tất cả sản phẩm", href: all }, ...flat.map((c) => ({ label: c.name, href: href(c) }))]} />;
      break;
    }
    case "chips":
    case "tiles": {
      const cls = a.design === "chips" ? chipCls : tileCls;
      body = (
        <ul className={a.design === "chips" ? "flex flex-wrap gap-2" : "grid grid-cols-2 gap-2"}>
          <li>
            <a href={all} className={cls(!filters.catalogueId)}>
              All
            </a>
          </li>
          {flat.map((c) => (
            <li key={String(c.id)}>
              <a href={href(c)} aria-current={active(c) ? "page" : undefined} className={cls(active(c))}>
                {c.name}
              </a>
            </li>
          ))}
        </ul>
      );
      break;
    }
    case "checkbox":
      body = (
        <ul className="space-y-0.5">
          {flat.map((c) => (
            <li key={String(c.id)}>
              <a href={active(c) ? all : href(c)} aria-current={active(c) ? "page" : undefined} className={rowCls(active(c))}>
                <Box on={active(c)} /> {c.name}
              </a>
            </li>
          ))}
        </ul>
      );
      break;
    case "accordion":
      body = (
        <ul className="divide-y divide-az-border">
          {d.tree.map((c) =>
            c.children.length ? (
              <li key={String(c.id)}>
                <details open={active(c) || flatten(c.children).some(active)} className="group py-1">
                  <summary className="flex cursor-pointer list-none items-center justify-between py-1.5 text-sm [&::-webkit-details-marker]:hidden">
                    <a href={href(c)} className={active(c) ? "font-semibold" : "hover:underline"}>
                      {c.name}
                    </a>
                    <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden="true" />
                  </summary>
                  <ul className="pb-1 pl-3">
                    {flatten(c.children).map((x) => (
                      <li key={String(x.id)}>
                        <a href={href(x)} className={`block py-1 text-[13px] ${active(x) ? "font-semibold" : "text-az-muted hover:text-az-text"}`}>
                          {x.name}
                        </a>
                      </li>
                    ))}
                  </ul>
                </details>
              </li>
            ) : (
              <li key={String(c.id)}>
                <a href={href(c)} className={`block py-2.5 text-sm ${active(c) ? "font-semibold" : "hover:underline"}`}>
                  {c.name}
                </a>
              </li>
            ),
          )}
        </ul>
      );
      break;
    default:
      body = (
        <ul className="space-y-0.5">
          {(filters.catalogueId || filters.keyword) && (
            <li>
              <a href={all} className="flex items-center gap-1 rounded-md px-2 py-1.5 text-sm text-az-muted hover:bg-az-bg hover:text-az-text">
                <ChevronLeft className="size-3.5" aria-hidden="true" /> Tất cả sản phẩm
              </a>
            </li>
          )}
          {d.tree.map((c) => (
            <CatLink key={String(c.id)} node={c} current={filters.catalogueId} keyword={filters.keyword} depth={0} />
          ))}
        </ul>
      );
  }
  return (
    <Shell o={a} title="Danh mục sản phẩm">
      {body}
    </Shell>
  );
}

export async function FilterPrice(a: ListingArgs & FilterOpts) {
  const d = await loadCatalogueListing(a);
  if (!d) return null;
  const { filters, q } = d;
  const href = (key: string | null) => withParams(d, { price: key, low_price: null, high_price: null });
  const toggle = (key: string) => href(filters.price === key ? null : key);
  const form = (
    <form action={`${d.base}.html`} method="get" className="flex items-center gap-1.5">
      {q
        .filter(([k]) => !["price", "low_price", "high_price"].includes(k))
        .map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
      <label className="sr-only" htmlFor="low_price">
        Giá thấp nhất
      </label>
      <input id="low_price" name="low_price" inputMode="numeric" pattern="[0-9]*" placeholder="Từ" defaultValue={q.find(([k]) => k === "low_price")?.[1] ?? ""} className="az-input w-[4.5rem] min-w-0 flex-1 rounded-full px-3" />
      <span className="text-az-muted" aria-hidden="true">
        –
      </span>
      <label className="sr-only" htmlFor="high_price">
        Giá cao nhất
      </label>
      <input id="high_price" name="high_price" inputMode="numeric" pattern="[0-9]*" placeholder="Đến" defaultValue={q.find(([k]) => k === "high_price")?.[1] ?? ""} className="az-input w-[4.5rem] min-w-0 flex-1 rounded-full px-3" />
      <button type="submit" className="az-btn az-btn-buy px-3 py-1 text-xs">
        Go
      </button>
    </form>
  );
  let body: ReactNode;
  switch (a.design) {
    case "inputs":
      body = form;
      break;
    case "dropdown":
      body = (
        <NavSelect label="Giá" value={href(filters.price || null)} options={[{ label: "Tất cả mức giá", href: href(null) }, ...PRICE_RANGES.map((r) => ({ label: r.label, href: href(r.key) }))]} />
      );
      break;
    case "radio":
    case "checkbox":
      body = (
        <>
          <ul className="space-y-0.5">
            {PRICE_RANGES.map((r) => (
              <li key={r.key}>
                <a href={toggle(r.key)} className={rowCls(filters.price === r.key)}>
                  {a.design === "radio" ? <Radio on={filters.price === r.key} /> : <Box on={filters.price === r.key} />} {r.label}
                </a>
              </li>
            ))}
          </ul>
          <div className="mt-3">{form}</div>
        </>
      );
      break;
    case "tiles":
      body = (
        <ul className="grid grid-cols-2 gap-2">
          {PRICE_RANGES.map((r) => (
            <li key={r.key}>
              <a href={toggle(r.key)} className={tileCls(filters.price === r.key)}>
                {r.label}
              </a>
            </li>
          ))}
        </ul>
      );
      break;
    default:
      body = (
        <>
          <ul className="flex flex-wrap gap-2">
            {PRICE_RANGES.map((r) => (
              <li key={r.key}>
                <a href={toggle(r.key)} className={chipCls(filters.price === r.key)}>
                  {r.label}
                </a>
              </li>
            ))}
          </ul>
          <div className="mt-3">{form}</div>
        </>
      );
  }
  return (
    <Shell o={a} title="Giá">
      {body}
    </Shell>
  );
}

export async function FilterColors(a: ListingArgs & FilterOpts) {
  const d = await loadCatalogueListing(a);
  if (!d?.colors.length) return null;
  const { filters } = d;
  const toggle = (id: number) => withParams(d, { color: filters.color === id ? null : String(id) });
  const set = (id: number | null) => withParams(d, { color: id === null ? null : String(id) });
  const dot = (name: string, on: boolean, size = "size-5") => (
    <span className={`${size} shrink-0 rounded-full border ${on ? "ring-2 ring-az-cart ring-offset-1" : "border-black/20"}`} style={{ background: swatchColor(name) }} aria-hidden="true" />
  );
  let body: ReactNode;
  switch (a.design) {
    case "dropdown":
      body = <NavSelect label="Màu sắc" value={set(filters.color ?? null)} options={[{ label: "Tất cả màu", href: set(null) }, ...d.colors.map((c) => ({ label: c.name, href: set(c.id) }))]} />;
      break;
    case "swatches":
      body = (
        <ul className="flex flex-wrap gap-2.5">
          {d.colors.map((c) => (
            <li key={c.id}>
              <a href={toggle(c.id)} title={c.name} aria-current={filters.color === c.id ? "true" : undefined} className="block">
                {dot(c.name, filters.color === c.id, "size-8")}
                <span className="sr-only">{c.name}</span>
              </a>
            </li>
          ))}
        </ul>
      );
      break;
    case "chips":
      body = (
        <ul className="flex flex-wrap gap-2">
          {d.colors.map((c) => (
            <li key={c.id}>
              <a href={toggle(c.id)} className={chipCls(filters.color === c.id)}>
                {dot(c.name, false, "size-3.5")} {c.name}
              </a>
            </li>
          ))}
        </ul>
      );
      break;
    case "checkbox":
      body = (
        <ul className="space-y-0.5">
          {d.colors.map((c) => (
            <li key={c.id}>
              <a href={toggle(c.id)} className={rowCls(filters.color === c.id)}>
                <Box on={filters.color === c.id} /> {dot(c.name, false, "size-3.5")} {c.name}
              </a>
            </li>
          ))}
        </ul>
      );
      break;
    default:
      body = (
        <ul className="grid grid-cols-2 gap-x-2 gap-y-1">
          {d.colors.map((c) => (
            <li key={c.id}>
              <a
                href={toggle(c.id)}
                aria-current={filters.color === c.id ? "true" : undefined}
                className={`flex items-center gap-2 rounded-md px-1.5 py-1 text-[13px] ${filters.color === c.id ? "bg-az-bg font-semibold" : "hover:bg-az-bg"}`}
              >
                {dot(c.name, filters.color === c.id)}
                <span className="truncate">{c.name}</span>
              </a>
            </li>
          ))}
        </ul>
      );
  }
  return (
    <Shell o={a} title="Màu sắc">
      {body}
    </Shell>
  );
}

export async function FilterRating(a: ListingArgs & FilterOpts) {
  const d = await loadCatalogueListing(a);
  if (!d) return null;
  const cur = d.filters.rating;
  const toggle = (r: number) => withParams(d, { rating: cur === r ? null : String(r) });
  const set = (r: number | null) => withParams(d, { rating: r === null ? null : String(r) });
  let body: ReactNode;
  switch (a.design) {
    case "dropdown":
      body = <NavSelect label="Đánh giá" value={set(cur || null)} options={[{ label: "Tất cả", href: set(null) }, ...[4, 3, 2, 1].map((r) => ({ label: `${r} sao trở lên`, href: set(r) }))]} />;
      break;
    case "list":
    case "radio":
      body = (
        <ul className="space-y-0.5">
          {[4, 3, 2, 1].map((r) => (
            <li key={r}>
              <a href={toggle(r)} className={rowCls(cur === r)}>
                {a.design === "radio" && <Radio on={cur === r} />}
                <Stars rating={r} size={15} /> <span>trở lên</span>
              </a>
            </li>
          ))}
        </ul>
      );
      break;
    default:
      body = (
        <ul className="flex flex-wrap gap-2">
          {[4, 3].map((r) => (
            <li key={r}>
              <a href={toggle(r)} className={chipCls(cur === r)}>
                <Stars rating={r} size={13} /> <span>trở lên</span>
              </a>
            </li>
          ))}
        </ul>
      );
  }
  return (
    <Shell o={a} title="Đánh giá">
      {body}
    </Shell>
  );
}

/** Chi hien khi dang loc; trong trinh dung giao dien (editor) hien san de con thay ma sua. */
export async function ClearFilters(a: ListingArgs & { always?: boolean; design?: string; label?: string }) {
  const d = await loadCatalogueListing(a);
  if (!d || (!d.anyFilter && !a.always)) return null;
  const cls =
    a.design === "button"
      ? "flex w-full items-center justify-center rounded-full border-2 border-current px-4 py-2 text-sm font-semibold hover:bg-black/5"
      : a.design === "chip"
        ? "inline-flex items-center gap-1 rounded-full bg-az-bg px-3 py-1 text-[13px] hover:bg-az-border"
        : "block text-center text-sm font-medium text-az-cart hover:underline";
  return (
    <a href={withParams(d, { price: null, low_price: null, high_price: null, color: null, rating: null })} className={cls}>
      {a.design === "chip" && <X className="size-3.5" aria-hidden="true" />}
      {a.label || "Xóa bộ lọc"}
    </a>
  );
}

export async function ResultCount(a: ListingArgs) {
  const d = await loadCatalogueListing(a);
  if (!d) return null;
  const { filters, result } = d;
  return (
    <p className="text-sm">
      {result.total ? `${d.from}-${d.to} trong ${result.total} sản phẩm` : "Không có sản phẩm"}
      {filters.keyword ? (
        <>
          {" "}
          for <span className="font-bold text-az-orange">&quot;{filters.keyword}&quot;</span>
        </>
      ) : null}
      {d.selectedCatName && (filters.keyword || a.catalogueId === null) ? <span className="text-az-muted"> in {d.selectedCatName}</span> : null}
    </p>
  );
}

export async function SortBar(a: ListingArgs) {
  const d = await loadCatalogueListing(a);
  if (!d) return null;
  return <SortSelect action={`${d.base}.html`} value={d.filters.sort} options={Object.entries(SORTS)} hidden={d.q.filter(([k]) => k !== "sort")} />;
}

export async function CataloguePager(a: ListingArgs) {
  const d = await loadCatalogueListing(a);
  if (!d) return null;
  return <Pager base={d.base} page={Math.min(d.page, d.lastPage)} lastPage={d.lastPage} query={d.q} />;
}

function flatten(nodes: CatNode[]): CatNode[] {
  return nodes.flatMap((n) => [n, ...flatten(n.children)]);
}

function CatLink({ node, current, keyword, depth }: { node: CatNode; current: number | null; keyword: string; depth: number }) {
  const active = Number(node.id) === current;
  const href = catHref(node, keyword);
  return (
    <li style={{ paddingLeft: depth * 14 }}>
      <a
        href={href}
        aria-current={active ? "page" : undefined}
        className={`block rounded-md border-l-[3px] px-2 py-1.5 text-sm ${
          active ? "border-az-cart bg-az-bg font-semibold text-az-text" : "border-transparent text-az-text hover:bg-az-bg"
        } ${depth ? "text-[13px]" : ""}`}
      >
        {node.name}
      </a>
      {node.children.length > 0 && (
        <ul>
          {node.children.map((c) => (
            <CatLink key={String(c.id)} node={c} current={current} keyword={keyword} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}
