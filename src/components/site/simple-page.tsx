import type { Seo } from "@/modules/frontend/helpers";
import { SiteFrame } from "./site-frame";
import { siteName } from "@/lib/site";

/** Khung trang noi dung don gian (trang chinh sach, trang cu cua WACO con giu route). */
export async function SimplePage({ seo, title, updated, children }: { seo: Seo; title: string; updated?: string; children: React.ReactNode }) {
  return (
    <SiteFrame seo={seo}>
      <article className="mx-auto max-w-[820px] px-4 py-8">
        <h1 className="az-h1">{title}</h1>
        {updated ? <p className="mt-1 text-sm text-az-muted">Cập nhật lần cuối: {updated}</p> : null}
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
      <p>Trang này không còn khả dụng. {shop} bán hàng trực tiếp đến khách hàng.</p>
      <p>
        <a href="/products.html">Xem tất cả sản phẩm</a> hoặc <a href="/contact.html">liên hệ với chúng tôi</a> nếu bạn có câu hỏi.
      </p>
    </SimplePage>
  );
}
