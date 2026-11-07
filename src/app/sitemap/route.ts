import { sitemapResponse } from "@/modules/frontend/info/sitemap";

/** GET /sitemap — Frontend\SitemapController@index (route sitemap.index). */
export async function GET() {
  return sitemapResponse();
}
