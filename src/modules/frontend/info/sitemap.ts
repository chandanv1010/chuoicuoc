import "server-only";
import { db } from "@/lib/db";
import { getCurrentLanguage } from "@/lib/language";
import { e, url, writeUrl } from "@/modules/frontend/helpers";

/**
 * Frontend\SitemapController@index + resources/views/frontend/sitemap/index.blade.php
 * (GET /sitemap va /sitemap.xml). File Blade dung CRLF nen ket qua cung CRLF.
 */
type Url = { loc: string; lastmod: string; changefreq: string; priority: string };

/** Carbon toAtomString() / date('c') voi gio dia phuong +07:00 (Prisma doc gio dia phuong nhu UTC). */
function atom(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}T${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}+07:00`;
}
const nowAtom = () => atom(new Date(Date.now() + 7 * 3600_000));

/** Model co SoftDeletes: find() bo qua ban ghi da xoa. */
async function published(table: "product_catalogues" | "products" | "post_catalogues" | "posts", id: bigint) {
  const where = { id, deleted_at: null };
  const row =
    table === "product_catalogues"
      ? await db.product_catalogues.findFirst({ where, select: { publish: true } })
      : table === "products"
        ? await db.products.findFirst({ where, select: { publish: true } })
        : table === "post_catalogues"
          ? await db.post_catalogues.findFirst({ where, select: { publish: true } })
          : await db.posts.findFirst({ where, select: { publish: true } });
  return !!row && Number(row.publish) === 2;
}

export async function sitemapResponse(): Promise<Response> {
  const lang = await getCurrentLanguage();
  const urls: Url[] = [
    { loc: url("/"), lastmod: nowAtom(), changefreq: "daily", priority: "1.0" },
    { loc: writeUrl("contact"), lastmod: nowAtom(), changefreq: "weekly", priority: "0.8" },
  ];

  const routers = await db.routers.findMany({ where: { language_id: lang.id } });
  for (const router of routers) {
    let publish = true;
    let priority = "0.8";
    let changefreq = "weekly";
    const c = router.controllers;
    if (c.includes("ProductCatalogueController")) {
      publish = await published("product_catalogues", router.module_id);
      changefreq = "daily";
    } else if (c.includes("ProductController")) {
      publish = await published("products", router.module_id);
      priority = "0.9";
    } else if (c.includes("PostCatalogueController")) {
      publish = await published("post_catalogues", router.module_id);
      priority = "0.7";
    } else if (c.includes("PostController")) {
      publish = await published("posts", router.module_id);
      priority = "0.7";
    }
    if (publish) {
      urls.push({
        loc: writeUrl(router.canonical),
        lastmod: router.updated_at ? atom(router.updated_at) : nowAtom(),
        changefreq,
        priority,
      });
    }
  }

  // Landing page cua trinh dung giao dien da xuat ban (slug lp-<duong-dan>)
  const landings = await db.$queryRaw<{ slug: string; published_at: Date | null }[]>`
    SELECT slug, published_at FROM builder_pages WHERE slug LIKE 'lp-%' AND published IS NOT NULL`;
  for (const l of landings)
    urls.push({ loc: writeUrl(l.slug.slice(3)), lastmod: l.published_at ? atom(l.published_at) : nowAtom(), changefreq: "weekly", priority: "0.8" });

  const NL = "\r\n";
  let xml = `<?xml version="1.0" encoding="UTF-8"?>${NL}<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${NL}`;
  for (const u of urls) {
    xml +=
      `    <url>${NL}` +
      `        <loc>${e(u.loc)}</loc>${NL}` +
      `        <lastmod>${e(u.lastmod)}</lastmod>${NL}` +
      `        <changefreq>${u.changefreq}</changefreq>${NL}` +
      `        <priority>${u.priority}</priority>${NL}` +
      `    </url>${NL}`;
  }
  xml += `</urlset>${NL}`;
  return new Response(xml, { headers: { "content-type": "text/xml; charset=UTF-8" } });
}
