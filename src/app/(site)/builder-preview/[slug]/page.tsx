import { notFound } from "next/navigation";
import { SiteFrame } from "@/components/site/site-frame";
import { authorize } from "@/server/auth";
import { firstRecordId, resolveBlockData } from "@/modules/builder/data";
import { getDraft, pageInfo } from "@/modules/builder/pages";
import { BuilderTree } from "@/modules/builder/render";
import { renderSlots } from "@/modules/builder/slots";

export const metadata = { robots: { index: false, follow: false } };

/** GET /builder-preview/{slug}[?id=] — xem truoc ban nhap (chi admin), giong het trang that; template xem voi ban ghi ?id. */
export default async function Page({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ id?: string }> }) {
  await authorize("home.feature.index");
  const { slug } = await params;
  const info = pageInfo(slug);
  if (!info) notFound();
  const { doc } = await getDraft(slug);
  const recordId = info.kind ? (info.recordId ?? (Number((await searchParams).id) || (await firstRecordId(info.kind)))) : null;
  const ctx = info.kind && recordId ? { kind: info.kind, id: recordId, page: 1, query: [] as [string, string][], preview: true } : null;
  const seo = { meta_title: `Xem trước: ${info.title}`, meta_keyword: "", meta_description: "", meta_image: "", canonical: "" };
  return (
    <SiteFrame seo={seo} bg="gray" settings={doc.settings} chrome={!info.part}>
      <div className="sticky top-0 z-50 bg-[#0d99ff] px-4 py-1.5 text-center text-xs font-medium text-white">Bản xem trước (bản nháp) — khách chưa thấy</div>
      <BuilderTree doc={doc} data={await resolveBlockData(doc, ctx)} slots={renderSlots(doc, ctx)} />
    </SiteFrame>
  );
}
