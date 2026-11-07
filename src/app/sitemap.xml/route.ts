import { sitemapResponse } from "@/modules/frontend/info/sitemap";

/** GET /sitemap.xml — Frontend\SitemapController@index (route sitemap.xml). */
export async function GET() {
  return sitemapResponse();
}
