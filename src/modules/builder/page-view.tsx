import "server-only";
import { notFound } from "next/navigation";
import { SiteFrame } from "@/components/site/site-frame";
import { FRONTEND_LANGUAGE } from "@/modules/frontend/core";
import { seo, url, type Seo } from "@/modules/frontend/helpers";
import { getPostById, getPostCatalogueById } from "@/modules/frontend/post";
import { getProductById, getProductCatalogueById } from "@/modules/frontend/product";
import { resolveBlockData } from "./data";
import { BuilderTree } from "./render";
import type { BuilderDoc, PageKind } from "./schema";
import { renderSlots } from "./slots";

/** SEO cua trang con theo loai (giong cac trang code cung); null = ban ghi khong ton tai. */
export async function pageSeo(kind: PageKind, id: bigint, page: number): Promise<Seo | null> {
  const lang = FRONTEND_LANGUAGE;
  if (kind === "product") {
    const p = await getProductById(id, lang);
    return p ? seo(p) : null;
  }
  if (kind === "catalogue") {
    const c = await getProductCatalogueById(id, lang);
    return c ? seo(c, page) : null;
  }
  if (kind === "post") {
    const p = await getPostById(id, lang);
    return p ? seo(p) : null;
  }
  const c = await getPostCatalogueById(id, lang);
  return c ? seo(c, page) : null;
}

/**
 * Trang con dung template / thiet ke rieng da xuat ban (thay ProductView, ProductCatalogueView...): khung site +
 * cay builder voi ban ghi dang xem va cac khoi trang ve bang giao dien code.
 */
export async function BuiltPage({ doc, kind, id, page, query }: { doc: BuilderDoc; kind: PageKind; id: bigint; page: number; query: [string, string][] }) {
  const meta = await pageSeo(kind, id, page);
  if (!meta) notFound();
  const ctx = { kind, id: Number(id), page, query };
  const data = await resolveBlockData(doc, ctx);
  return (
    <SiteFrame seo={meta} settings={doc.settings}>
      <BuilderTree doc={doc} data={data} slots={renderSlots(doc, ctx)} />
    </SiteFrame>
  );
}

/** Landing page tu tao (/<path>.html): SEO lay tu "Cài đặt trang", thieu thi dung ten trang / cau hinh he thong. */
export async function LandingPage({ path, doc, title }: { path: string; doc: BuilderDoc; title: string }) {
  const s = doc.settings ?? {};
  const meta: Seo = {
    meta_title: s.seoTitle || title,
    meta_keyword: "",
    meta_description: s.seoDescription ?? "",
    meta_image: s.seoImage ?? "",
    canonical: url(`/${path}.html`),
  };
  return (
    <SiteFrame seo={meta} settings={doc.settings}>
      <BuilderTree doc={doc} data={await resolveBlockData(doc)} slots={renderSlots(doc, null)} />
    </SiteFrame>
  );
}
