import "server-only";
import { Prisma } from "@prisma/client";
import { cache } from "react";
import type { HeroCard } from "@/components/site/category-hero";
import { productHref } from "@/components/site/product-card";
import { db } from "@/lib/db";
import { siteName } from "@/lib/site";
import { FRONTEND_LANGUAGE } from "@/modules/frontend/core";
import { formatPrice } from "@/modules/frontend/money";
import {
  getHomeProducts,
  getStoreCatalogues,
  getRelatedStoreProducts,
  productsByIds,
  readFilters,
  searchProducts,
  type StoreProduct,
} from "@/modules/frontend/storefront";
import { getCatalogueTree } from "@/modules/frontend/product";
import { getPostCatalogueById, paginatePosts } from "@/modules/frontend/post";
import { loadCatalogueListing } from "@/components/site/catalogue-parts";
import { KIND_RECORD, type BlockData, type BuilderDoc, type BuilderNode, type PageKind, type RecordKind } from "./schema";

/**
 * Du lieu that cho cac khoi cua hang, tinh tren server theo id node:
 *  - productRow / productGrid: StoreProduct[]
 *  - categoryHero: HeroCard[]
 *  - collection: Item[] — ban ghi phang {name, url, image, ...} de the mau thay {{truong}}
 * Storefront goi khi render; editor goi lai qua server action khi doi nguon / so luong.
 */

export type Item = Record<string, string>;

/** Mau nen pastel xoay vong cho {{bg}} (giong the danh muc trang chu). */
const PALETTE = ["#f6dccf", "#e3e8d6", "#dbe6ea", "#efe3ef", "#f3ead2", "#e4e2f2"];

const strip = (html: string | null | undefined) =>
  (html ?? "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

const productItem = (p: StoreProduct, i: number, description = ""): Item => ({
  name: p.name,
  url: productHref(p),
  image: p.image ?? "",
  price: formatPrice(p.price),
  rating: p.reviews ? p.rating.toFixed(1) : "",
  reviews: String(p.reviews),
  description,
  bg: PALETTE[i % PALETTE.length],
});

type PostRow = { id: bigint; name: string; canonical: string; description: string | null; image: string | null; created_at: Date | null };

/** Bai viet dang hien: moi nhat, hoac theo id (giu thu tu). */
async function postRows(opts: { ids?: number[]; limit?: number; keyword?: string }): Promise<PostRow[]> {
  const LANG = FRONTEND_LANGUAGE;
  if (opts.ids) {
    if (!opts.ids.length) return [];
    const rows = await db.$queryRaw<PostRow[]>`
      SELECT p.id, pl.name, pl.canonical, pl.description, p.image, p.created_at FROM posts p
      JOIN post_language pl ON pl.post_id = p.id AND pl.language_id = ${LANG}
      WHERE p.deleted_at IS NULL AND p.id IN (${Prisma.join(opts.ids)})`;
    return opts.ids.map((id) => rows.find((r) => Number(r.id) === id)).filter((r): r is PostRow => !!r);
  }
  const kw = opts.keyword ? `%${opts.keyword}%` : "%";
  return db.$queryRaw<PostRow[]>`
    SELECT p.id, pl.name, pl.canonical, pl.description, p.image, p.created_at FROM posts p
    JOIN post_language pl ON pl.post_id = p.id AND pl.language_id = ${LANG}
    WHERE p.deleted_at IS NULL AND p.publish = 2 AND pl.name LIKE ${kw}
    ORDER BY p.created_at DESC, p.id DESC LIMIT ${opts.limit ?? 12}`;
}

const postItem = (r: PostRow, i: number): Item => ({
  name: r.name,
  url: productHref({ canonical: r.canonical }),
  image: r.image ?? "",
  description: strip(r.description),
  date: r.created_at ? r.created_at.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "",
  bg: PALETTE[i % PALETTE.length],
});

type CatalogueInfo = { id: number; name: string; canonical: string | null; description: string; image: string | null; level: number; count: number };

/** Moi danh muc dang hien kem anh rieng (hoac anh san pham dau tien), mo ta, so san pham. */
const allCatalogues = cache(async (): Promise<CatalogueInfo[]> => {
  const [rows, stats] = await Promise.all([
    db.$queryRaw<{ id: bigint; name: string; canonical: string | null; description: string | null; image: string | null; level: number }[]>`
      SELECT pc.id, pcl.name, pcl.canonical, pcl.description, pc.image, pc.level FROM product_catalogues pc
      JOIN product_catalogue_language pcl ON pcl.product_catalogue_id = pc.id AND pcl.language_id = ${FRONTEND_LANGUAGE}
      WHERE pc.publish = 2 AND pc.deleted_at IS NULL
      ORDER BY pc.lft ASC, pc.id ASC`,
    getStoreCatalogues(),
  ]);
  return rows.map((r) => {
    const st = stats.find((x) => x.id === Number(r.id));
    return {
      id: Number(r.id),
      name: r.name,
      canonical: r.canonical,
      description: strip(r.description),
      image: r.image || st?.images[0] || null,
      level: r.level,
      count: st?.count ?? 0,
    };
  });
});

async function cataloguesFor(n: BuilderNode, defaultLimit = 12): Promise<CatalogueInfo[]> {
  const all = await allCatalogues();
  const limit = Math.max(1, Math.min(48, n.props.limit ?? defaultLimit));
  const src = n.props.catSource ?? "top";
  if (src === "manual") return (n.props.catalogueIds ?? []).map((id) => all.find((c) => c.id === id)).filter((c): c is CatalogueInfo => !!c);
  // "top": danh muc cap 1; neu cay chi co 1 cap thi lay het
  const minLevel = Math.min(...all.map((c) => c.level));
  return (src === "top" ? all.filter((c) => c.level === minLevel) : all).slice(0, limit);
}

/** Trang con dang xem (template): loai trang + id ban ghi. */
export type PageCtx = { kind: PageKind; id: number; page?: number; query?: [string, string][] };

/** Khoa du lieu cua ban ghi trang dang xem (template gan voi no o goc). */
export const RECORD_KEY = "__record";

/** Khoa ten shop (systems.homepage_company) cho khoi logo dang chu. */
export const SITE_NAME_KEY = "__site_name";

export async function resolveBlockData(doc: BuilderDoc, ctx?: PageCtx | null): Promise<BlockData> {
  const data: BlockData = { [SITE_NAME_KEY]: await siteName() };
  if (ctx) data[RECORD_KEY] = await pageRecord(ctx);
  let home: Promise<Awaited<ReturnType<typeof getHomeProducts>>> | null = null;
  const homeRows = () => (home ??= getHomeProducts());

  const products = async (n: BuilderNode): Promise<StoreProduct[]> => {
    const limit = Math.max(1, Math.min(48, n.props.limit ?? 12));
    switch (n.props.source ?? "bestsellers") {
      case "bestsellers":
        return (await homeRows()).bestSellers.slice(0, limit);
      case "christmas":
        return (await homeRows()).christmas.slice(0, limit);
      case "newest":
        return (await searchProducts(readFilters([["sort", "newest"]], null), 1, limit)).items;
      case "catalogue":
        return n.props.catalogueId ? (await searchProducts(readFilters([], n.props.catalogueId), 1, limit)).items : [];
      case "keyword":
        return n.props.keyword ? (await searchProducts(readFilters([["keyword", n.props.keyword]], null), 1, limit)).items : [];
      case "manual":
        return productsByIds(n.props.productIds ?? []);
      case "listing":
        // Danh sach cua trang danh muc dang xem: dung bo loc / sap xep / trang so tren URL
        if (ctx?.kind !== "catalogue") return [];
        return (await loadCatalogueListing({ catalogueId: BigInt(ctx.id), page: ctx.page ?? 1, query: ctx.query ?? [] }))?.result.items ?? [];
      case "related":
        // Theo trang dang xem: trang san pham -> cung danh muc (bo chinh no); trang danh muc -> san pham cua danh muc
        if (ctx?.kind === "catalogue") return (await searchProducts(readFilters([], ctx.id), 1, limit)).items;
        if (ctx?.kind === "product") {
          const [p] = await productsByIds([ctx.id]);
          return p ? (await getRelatedStoreProducts(BigInt(ctx.id), p.catalogueId)).slice(0, limit) : [];
        }
        return [];
      default:
        return [];
    }
  };

  const heroCards = async (n: BuilderNode): Promise<HeroCard[]> => {
    // Danh muc lay tu DB: mac dinh 3 danh muc cap 1, hoac danh muc chon tay
    return (await cataloguesFor(n, 3)).map((c, i) => ({
      title: c.name,
      subtitle: c.description.slice(0, 120),
      href: c.canonical ? `/${c.canonical}.html` : "/products.html",
      image: c.image,
      bg: `linear-gradient(160deg,${PALETTE[i % PALETTE.length]} 0%,#f7f2ea 100%)`,
      cta: c.count ? "Shop now" : "Coming soon",
      count: c.count,
    }));
  };

  const items = async (n: BuilderNode): Promise<Item[]> => {
    if (n.props.collection === "products") return (await products(n)).map((p, i) => productItem(p, i));
    if (n.props.collection === "posts") {
      const limit = Math.max(1, Math.min(48, n.props.limit ?? 6));
      if (n.props.source === "listing" && ctx?.kind === "postcat") return (await postListing(ctx)).map(postItem);
      if (n.props.source === "related" && ctx?.kind === "post") return (await relatedPosts(ctx.id, limit)).map(postItem);
      const ids = n.props.source === "manual" ? (n.props.productIds ?? []) : undefined;
      return (await postRows({ ids, limit })).map(postItem);
    }
    return (await cataloguesFor(n)).map((c, i) => ({
      name: c.name,
      url: c.canonical ? `/${c.canonical}.html` : "/products.html",
      image: c.image ?? "",
      count: String(c.count),
      description: c.description,
      bg: PALETTE[i % PALETTE.length],
    }));
  };

  await Promise.all(
    Object.values(doc.nodes).map(async (n) => {
      if (n.type === "productRow" || n.type === "productGrid") data[n.id] = await products(n);
      else if (n.type === "categoryHero") data[n.id] = await heroCards(n);
      else if (n.type === "collection") data[n.id] = await items(n);
      else if (n.type === "nav") data[n.id] = await navLinks(n);
      if (n.props.bind) data[n.id] = await boundItem(n.props.bind.kind, n.props.bind.id);
    }),
  );
  return data;
}

/** Danh muc cho o chon trong inspector (ca cap con, kem cap de thut le). */
export async function catalogueOptions() {
  return (await allCatalogues()).map((c) => ({ id: c.id, name: c.name, count: c.count, level: c.level }));
}

/** Mot ban ghi cho khung "Gắn dữ liệu" (null: ban ghi da bi xoa / an). */
async function boundItem(kind: RecordKind, id: number): Promise<Item | null> {
  if (kind === "products") {
    const [p] = await productsByIds([id]);
    if (!p) return null;
    const [d] = await db.$queryRaw<{ description: string | null }[]>`
      SELECT description FROM product_language WHERE product_id = ${id} AND language_id = ${FRONTEND_LANGUAGE} LIMIT 1`;
    return productItem(p, 0, strip(d?.description).slice(0, 300));
  }
  if (kind === "posts") {
    const [r] = await postRows({ ids: [id] });
    return r ? postItem(r, 0) : null;
  }
  const c = (await allCatalogues()).find((x) => x.id === id);
  return c
    ? { name: c.name, url: c.canonical ? `/${c.canonical}.html` : "/products.html", image: c.image ?? "", count: String(c.count), description: c.description, bg: PALETTE[0] }
    : null;
}

/** Menu: lien ket tu nhap, chen danh muc (cap 1 + cap 2) ngay sau lien ket dau tien neu bat. */
async function navLinks(n: BuilderNode) {
  const links: { name: string; href: string; children?: { name: string; href: string }[] }[] = (n.props.links ?? []).map((l) => ({ name: l.label, href: l.href }));
  if (!n.props.withCategories) return links;
  const tree = await getCatalogueTree(FRONTEND_LANGUAGE);
  const cats = tree.map((c) => ({
    name: c.name,
    href: `/${c.canonical}.html`,
    children: c.children.map((k) => ({ name: k.name, href: `/${k.canonical}.html` })),
  }));
  return [...links.slice(0, 1), ...cats, ...links.slice(1)];
}

/** O tim ban ghi cho inspector: "Chọn tay" va "Gắn dữ liệu". */
export async function recordOptions(kind: RecordKind, keyword: string, ids?: number[]) {
  if (kind === "products") {
    const list = ids ? await productsByIds(ids) : (await searchProducts(readFilters(keyword ? [["keyword", keyword]] : [], null), 1, 20)).items;
    return list.map((p) => ({ id: p.id, name: p.name, image: p.image, sub: formatPrice(p.price) }));
  }
  if (kind === "posts") {
    const rows = await postRows(ids ? { ids } : { keyword, limit: 20 });
    return rows.map((r) => ({ id: Number(r.id), name: r.name, image: r.image, sub: r.created_at?.toISOString().slice(0, 10) ?? "" }));
  }
  const all = await allCatalogues();
  const list = ids ? ids.map((id) => all.find((c) => c.id === id)).filter((c): c is CatalogueInfo => !!c) : all.filter((c) => c.name.toLowerCase().includes(keyword.toLowerCase()));
  return list.map((c) => ({ id: c.id, name: c.name, image: c.image, sub: `${c.count} sản phẩm` }));
}

/** Ban ghi cua trang con dang xem duoi dang {{truong}} (ten, gia, mo ta, anh, link, danh muc...). */
export async function pageRecord(ctx: PageCtx): Promise<Item | null> {
  if (ctx.kind === "product") {
    const it = await boundItem("products", ctx.id);
    if (!it) return null;
    const [p] = await productsByIds([ctx.id]);
    const cat = p ? (await allCatalogues()).find((c) => c.id === p.catalogueId) : undefined;
    return { ...it, category: cat?.name ?? "", categoryUrl: cat?.canonical ? `/${cat.canonical}.html` : "/products.html" };
  }
  if (ctx.kind === "catalogue") return boundItem("categories", ctx.id);
  if (ctx.kind === "post") return boundItem("posts", ctx.id);
  const [r] = await db.$queryRaw<{ name: string; canonical: string | null; description: string | null; image: string | null }[]>`
    SELECT pcl.name, pcl.canonical, pcl.description, pc.image FROM post_catalogues pc
    JOIN post_catalogue_language pcl ON pcl.post_catalogue_id = pc.id AND pcl.language_id = ${FRONTEND_LANGUAGE}
    WHERE pc.id = ${ctx.id} LIMIT 1`;
  return r ? { name: r.name, url: r.canonical ? `/${r.canonical}.html` : "/", image: r.image ?? "", description: strip(r.description), count: "", bg: PALETTE[0] } : null;
}

/** Ban ghi dau tien cua mot loai trang — de xem truoc template khi chua chon ban ghi nao. */
export async function firstRecordId(kind: PageKind): Promise<number | null> {
  const rows =
    kind === "product"
      ? await db.$queryRaw<{ id: bigint }[]>`SELECT id FROM products WHERE publish = 2 AND deleted_at IS NULL ORDER BY id DESC LIMIT 1`
      : kind === "catalogue"
        ? await db.$queryRaw<{ id: bigint }[]>`SELECT id FROM product_catalogues WHERE publish = 2 AND deleted_at IS NULL ORDER BY lft LIMIT 1`
        : kind === "post"
          ? await db.$queryRaw<{ id: bigint }[]>`SELECT id FROM posts WHERE publish = 2 AND deleted_at IS NULL ORDER BY id DESC LIMIT 1`
          : await db.$queryRaw<{ id: bigint }[]>`SELECT id FROM post_catalogues WHERE deleted_at IS NULL ORDER BY lft LIMIT 1`;
  return rows[0] ? Number(rows[0].id) : null;
}

/** Bai cua danh muc bai viet dang xem (theo trang so tren URL), moi nhat truoc. */
async function postListing(ctx: PageCtx): Promise<PostRow[]> {
  const catalogue = await getPostCatalogueById(BigInt(ctx.id), FRONTEND_LANGUAGE);
  if (!catalogue) return [];
  const page = await paginatePosts({ query: ctx.query ?? [], languageId: FRONTEND_LANGUAGE, catalogue, page: ctx.page ?? 1, path: catalogue.canonical ?? "" });
  return page.items.map((p) => ({ id: p.id, name: p.name ?? "", canonical: p.canonical ?? "", description: p.description, image: p.image, created_at: p.released_at ?? p.created_at }));
}

/** Bai khac cung danh muc voi bai dang xem. */
async function relatedPosts(postId: number, limit: number): Promise<PostRow[]> {
  return db.$queryRaw<PostRow[]>`
    SELECT p.id, pl.name, pl.canonical, pl.description, p.image, p.created_at FROM posts p
    JOIN post_language pl ON pl.post_id = p.id AND pl.language_id = ${FRONTEND_LANGUAGE}
    WHERE p.deleted_at IS NULL AND p.publish = 2 AND p.id <> ${postId}
      AND p.post_catalogue_id = (SELECT post_catalogue_id FROM posts WHERE id = ${postId})
    ORDER BY p.created_at DESC, p.id DESC LIMIT ${limit}`;
}

/** Tim trang con theo loai de tao thiet ke rieng (trang quan ly trinh dung). */
export async function pageRecordSearch(kind: PageKind, keyword: string): Promise<{ id: number; name: string; sub: string }[]> {
  if (kind !== "postcat") {
    const list = await recordOptions(KIND_RECORD[kind], keyword);
    return list.slice(0, 20).map((r) => ({ id: Number(r.id), name: r.name, sub: r.sub }));
  }
  const like = `%${keyword}%`;
  const rows = await db.$queryRaw<{ id: bigint; name: string }[]>`
    SELECT pc.id, pcl.name FROM post_catalogues pc
    JOIN post_catalogue_language pcl ON pcl.post_catalogue_id = pc.id AND pcl.language_id = ${FRONTEND_LANGUAGE}
    WHERE pc.deleted_at IS NULL AND pcl.name LIKE ${like} ORDER BY pc.lft LIMIT 20`;
  return rows.map((r) => ({ id: Number(r.id), name: r.name, sub: "" }));
}
