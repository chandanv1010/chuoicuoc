import { notFound } from "next/navigation";
import { parseCanonical, RouterPage, type SearchParams } from "@/components/site/router-page";
import { LandingPage } from "@/modules/builder/page-view";
import { getLanding } from "@/modules/builder/pages";

/** GET /{canonical}.html — RouterController@index (route router.index); landing page cua trinh dung giao dien uu tien truoc. */
export default async function CanonicalPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: SearchParams;
}) {
  const canonical = parseCanonical((await params).slug);
  if (!canonical) notFound();
  const landing = await getLanding(canonical);
  if (landing) return <LandingPage path={canonical} {...landing} />;
  return <RouterPage canonical={canonical} pageParam={null} searchParams={await searchParams} />;
}
