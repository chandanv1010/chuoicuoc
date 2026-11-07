import { notFound } from "next/navigation";
import { authorize } from "@/server/auth";
import { catalogueOptions, firstRecordId, resolveBlockData } from "@/modules/builder/data";
import { Editor } from "@/modules/builder/editor/editor";
import { getDraft, listCustomParts, pageInfo } from "@/modules/builder/pages";
import { renderSlots } from "@/modules/builder/slots";

export const metadata = { title: "Sửa giao diện" };

/**
 * GET /builder/{slug}/edit — trinh dung giao dien: trang chu, header, footer, template trang con (tpl-product...)
 * va thiet ke rieng mot trang (product-123...). Template xem truoc voi ban ghi ?id= (mac dinh ban ghi dau tien).
 */
export default async function Page({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ id?: string }> }) {
  await authorize("home.feature.index");
  const { slug } = await params;
  const info = pageInfo(slug);
  if (!info) notFound();
  const [draft, catalogues, parts] = await Promise.all([getDraft(slug), catalogueOptions(), listCustomParts()]);
  const asked = Number((await searchParams).id) || null;
  const recordId = info.kind ? (info.recordId ?? asked ?? (await firstRecordId(info.kind))) : null;
  const ctx = info.kind && recordId ? { kind: info.kind, id: recordId, page: 1, query: [] as [string, string][], preview: true } : null;
  const data = await resolveBlockData(draft.doc, ctx);
  return (
    <Editor
      slug={slug}
      title={draft.title}
      doc={draft.doc}
      data={data}
      catalogues={catalogues}
      publishedAt={draft.publishedAt ? draft.publishedAt.toISOString() : null}
      page={{ kind: info.kind, recordId, fixed: !!info.recordId, landing: info.landing, part: info.part }}
      parts={parts}
      slots={renderSlots(draft.doc, ctx)}
    />
  );
}
