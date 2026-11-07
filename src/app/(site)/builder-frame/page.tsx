import { SiteFrame } from "@/components/site/site-frame";
import { requireAdmin } from "@/server/auth";
import { partKindOf } from "@/modules/builder/schema";
import { FrameSlot } from "./slot";

/**
 * Canvas cua trinh dung giao dien (nap trong iframe cua /builder/{slug}/edit): trang storefront that
 * (header, footer, CSS site) voi mot o trong — editor ve noi dung vao do bang React portal.
 * Khi sua header / footer: bo header / footer that, dat o trong o dau / cuoi va mot khoi gia lam noi dung trang.
 * ?header= / ?footer=: lua chon trong "Cài đặt trang" dang sua (editor nap lai iframe khi doi).
 */
export const metadata = { robots: { index: false, follow: false } };

const EDITOR_CSS = `
:where([data-node-id][data-empty]){min-height:72px;outline:1px dashed #9cc9f0;outline-offset:-1px;background:repeating-linear-gradient(45deg,rgba(13,153,255,.03) 0 8px,transparent 8px 16px)}
.bb-placeholder{grid-column:1/-1;display:flex;align-items:center;justify-content:center;min-height:96px;padding:16px;border:1px dashed #c9bfae;border-radius:8px;color:#8a8175;font-size:13px;text-align:center;background:#faf7f2}
.bb-dragging{opacity:.3;transition:opacity .15s}
[data-node-id]{cursor:default}
[data-node-id] iframe,[data-node-id] video{pointer-events:none}
.bb-cropping{cursor:move!important;outline:2px dashed #0d99ff;outline-offset:2px}
html{scrollbar-width:thin}
`;

function FakeContent() {
  return (
    <div className="mx-auto my-6 grid max-w-[1200px] gap-4 px-4 opacity-60" aria-hidden="true">
      <div className="h-48 rounded-xl bg-az-border/60" />
      <div className="grid grid-cols-3 gap-4">
        <div className="h-32 rounded-xl bg-az-border/50" />
        <div className="h-32 rounded-xl bg-az-border/50" />
        <div className="h-32 rounded-xl bg-az-border/50" />
      </div>
      <p className="text-center text-sm text-az-muted">Nội dung trang (chỉ để xem trước)</p>
    </div>
  );
}

export default async function Page({ searchParams }: { searchParams: Promise<{ slug?: string; header?: string; footer?: string }> }) {
  await requireAdmin();
  const { slug = "home", header, footer } = await searchParams;
  const seo = { meta_title: "Canvas", meta_keyword: "", meta_description: "", meta_image: "", canonical: "" };
  const part = partKindOf(slug);
  return (
    <SiteFrame seo={seo} bg="gray" showFlash={false} chrome={!part} settings={{ header, footer }}>
      <style dangerouslySetInnerHTML={{ __html: EDITOR_CSS }} />
      {part === "footer" && <FakeContent />}
      <FrameSlot />
      {part === "header" && <FakeContent />}
    </SiteFrame>
  );
}
