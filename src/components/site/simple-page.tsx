import type { Seo } from "@/modules/frontend/helpers";
import { SiteFrame } from "./site-frame";
import { siteName } from "@/lib/site";

/** Khung trang noi dung don gian (trang chinh sach, trang cu cua WACO con giu route). */
export async function SimplePage({ seo, title, updated, children }: { seo: Seo; title: string; updated?: string; children: React.ReactNode }) {
  return (
    <SiteFrame seo={seo}>
      <article className="mx-auto max-w-[820px] px-4 py-8">
        <h1 className="az-h1">{title}</h1>
        {updated ? <p className="mt-1 text-sm text-az-muted">Last updated: {updated}</p> : null}
        <div className="az-prose mt-5">{children}</div>
      </article>
    </SiteFrame>
  );
}

/** Trang WACO khong con ap dung (phan phoi, cong nghe, dai ly): giu URL, noi dung toi gian. */
export async function RetiredPage({ path, title }: { path: string; title: string }) {
  const shop = await siteName();
  const seo = { meta_title: title, meta_keyword: "", meta_description: "", meta_image: "", canonical: path };
  return (
    <SimplePage seo={seo} title={title}>
      <p>This page is no longer available. {shop} sells directly to customers — there is no dealer or distributor program.</p>
      <p>
        <a href="/products.html">Browse all products</a> or <a href="/contact.html">contact us</a> if you have a question.
      </p>
    </SimplePage>
  );
}
