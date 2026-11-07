import { url, type Seo } from "@/modules/frontend/helpers";
import { siteName } from "@/lib/site";

/**
 * Phan SEO cua head.blade.php ($seo do controller truyen). React 19 tu dua
 * <title>/<meta>/<link> len <head>. Tieu de luon kem ten shop (siteName()).
 */
export async function SeoHead({ seo }: { seo: Seo }) {
  const shop = await siteName();
  const base = seo.meta_title || shop;
  const title = base.includes(shop) ? base : `${base} | ${shop}`;
  // Facebook / Zalo / X chi doc anh chia se co duong dan tuyet doi: "/userfiles/..." -> "https://<APP_URL>/userfiles/..."
  const image = seo.meta_image && !/^https?:\/\//i.test(seo.meta_image) ? url(seo.meta_image) : seo.meta_image;
  return (
    <>
      <title>{title}</title>
      <meta name="description" content={seo.meta_description} />
      {seo.meta_keyword ? <meta name="keywords" content={seo.meta_keyword} /> : null}
      {seo.canonical ? <link rel="canonical" href={seo.canonical} /> : null}
      <meta property="og:locale" content="en_US" />
      <meta property="og:title" content={title} />
      <meta property="og:type" content="website" />
      {image ? <meta property="og:image" content={image} /> : null}
      {seo.canonical ? <meta property="og:url" content={seo.canonical} /> : null}
      <meta property="og:description" content={seo.meta_description} />
      <meta property="og:site_name" content={shop} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={seo.meta_description} />
      {image ? <meta name="twitter:image" content={image} /> : null}
    </>
  );
}
