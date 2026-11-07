/* eslint-disable @next/next/no-img-element -- anh qua route co kiem tra quyen */
import { notFound } from "next/navigation";
import { PageHeader, Section } from "@/components/admin/page";
import { CAP_COLORS, CAP_ZONES, COASTER_BACKINGS, COASTER_MATERIALS, coasterColor, NAPKIN_BORDERS, TEXT_FONTS, THREAD_COLORS, TSHIRT_COLORS } from "@/modules/design/config";
import { SHAPE_PRESETS } from "@/components/site/design/shapes";
import { machineReport } from "@/modules/design/machine";
import { MachineSection } from "@/modules/design/machine-section";
import { getDesignRequest } from "@/modules/design/requests";
import { authorize } from "@/server/auth";
import { siteName } from "@/lib/site";

export const metadata = { title: "Chi tiết thiết kế" };

const VIEW_LABEL: Record<string, string> = { front: "Trước", left: "Hông trái", right: "Hông phải", back: "Sau", napkin: "Khăn (nhìn trên)" };

/**
 * GET /design-request/<id> — phieu thiet ke cho xuong: anh chup 4 goc, tung hinh/chu voi vi tri,
 * kich thuoc (mm), goc xoay; tai anh goc de digitize (lam file DST/PES).
 */
export default async function DesignRequestDetail({ params }: { params: Promise<{ id: string }> }) {
  const shop = await siteName();
  await authorize("order.index");
  const { id } = await params;
  const r = await getDesignRequest(id);
  if (!r) notFound();
  const report = await machineReport(r);
  const color = r.spec.product === "hat" ? CAP_COLORS.find((c) => c.key === r.spec.color) : r.spec.product === "tshirt" ? TSHIRT_COLORS.find((c) => c.key === r.spec.color) : coasterColor(r.spec.material, r.spec.color);
  const file = (name: string, download = false) => `/design-request/${r.id}/file/${name}${download ? "?download=1" : ""}`;

  return (
    <>
      <PageHeader title={`Thiết kế ${r.code}`} crumbs={[{ label: "Thiết kế khách gửi", href: "/design-request/index" }, { label: r.code }]} />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          <Section title="Ảnh chụp mô hình">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {r.views.map((v) => {
                const key = v.replace(/^view-|\.\w+$/g, "");
                return (
                  <a key={v} href={file(v)} target="_blank" rel="noreferrer" className="block">
                    <img src={file(v)} alt={VIEW_LABEL[key] ?? key} className="w-full rounded-lg border bg-muted" />
                    <span className="mt-1 block text-center text-xs text-muted-foreground">{VIEW_LABEL[key] ?? key}</span>
                  </a>
                );
              })}
            </div>
          </Section>
          {r.spec.product === "napkin" && <MachineSection r={r} report={report} />}
          <Section title="Hình và chữ cần thêu">
            <div className="space-y-3">
              {r.spec.items.map((it, i) => {
                const zone = r.spec.product === "hat" ? CAP_ZONES.find((z) => z.key === it.zone)?.label : r.spec.product === "tshirt" ? (it.zone === "back" ? "Mặt sau áo" : "Mặt trước áo") : "Khăn";
                const placed = r.files[`placed-${it.id}`];
                const original = r.files[`original-${it.id}`];
                return (
                  <div key={it.id} className="flex flex-wrap gap-4 rounded-lg border p-3">
                    {placed && <img src={file(placed)} alt="" className="size-28 rounded border bg-[repeating-conic-gradient(#eee_0_25%,#fff_0_50%)] bg-[length:16px_16px] object-contain" />}
                    <dl className="grid min-w-60 flex-1 grid-cols-[110px_1fr] gap-x-3 gap-y-1 text-sm">
                      <dt className="text-muted-foreground">#{i + 1}</dt>
                      <dd className="font-medium">{it.kind === "text" ? `Chữ: “${it.text}”` : `Ảnh: ${it.fileName ?? ""}`}</dd>
                      <dt className="text-muted-foreground">Vị trí</dt>
                      <dd>{zone}</dd>
                      <dt className="text-muted-foreground">Kích thước</dt>
                      <dd>
                        {it.widthMm} × {it.heightMm} mm
                      </dd>
                      {it.kind === "image" && (
                        <>
                          <dt className="text-muted-foreground">Xóa nền</dt>
                          <dd>{it.removeBg ? "Có (dùng ảnh đã đặt)" : "Không"}</dd>
                        </>
                      )}
                      <dt className="text-muted-foreground">Góc xoay</dt>
                      <dd>{it.rotationDeg}°</dd>
                      {it.kind === "text" && (
                        <>
                          <dt className="text-muted-foreground">Font / chỉ</dt>
                          <dd>
                            {TEXT_FONTS.find((f) => f.key === it.font)?.label ?? it.font} · {THREAD_COLORS.find((c) => c.key === it.thread)?.label ?? it.thread}
                          </dd>
                        </>
                      )}
                      <dt className="text-muted-foreground">Toạ độ 3D (mm)</dt>
                      <dd className="font-mono text-xs">
                        {it.point.map((v) => v.toFixed(1)).join(", ")}
                      </dd>
                    </dl>
                    <div className="flex flex-col gap-2 text-sm">
                      {original && (
                        <a href={file(original, true)} className="text-primary hover:underline">
                          Tải ảnh gốc
                        </a>
                      )}
                      {placed && (
                        <a href={file(placed, true)} className="text-primary hover:underline">
                          Tải ảnh đã đặt (PNG)
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>
        </div>
        <div className="space-y-5">
          <Section title="Khách hàng">
            <dl className="grid grid-cols-[90px_1fr] gap-y-1 text-sm">
              <dt className="text-muted-foreground">Tên</dt>
              <dd>{r.customer.name}</dd>
              <dt className="text-muted-foreground">Email</dt>
              <dd>
                <a href={`mailto:${r.customer.email}?subject=${encodeURIComponent(`${shop} design ${r.code}`)}`} className="text-primary hover:underline">
                  {r.customer.email}
                </a>
              </dd>
              <dt className="text-muted-foreground">Số lượng</dt>
              <dd>{r.customer.quantity}</dd>
              <dt className="text-muted-foreground">Gửi lúc</dt>
              <dd>{new Date(r.created_at).toLocaleString("vi-VN")}</dd>
            </dl>
            {r.customer.notes && <p className="mt-3 rounded-md bg-muted p-3 text-sm whitespace-pre-line">{r.customer.notes}</p>}
          </Section>
          <Section title="Sản phẩm">
            <dl className="grid grid-cols-[90px_1fr] gap-y-1 text-sm">
              <dt className="text-muted-foreground">Loại</dt>
              <dd>{r.spec.product === "hat" ? "Mũ dad hat" : r.spec.product === "tshirt" ? "Áo phông" : "Khăn / lót cốc"}</dd>
              <dt className="text-muted-foreground">Màu</dt>
              <dd className="flex items-center gap-2">
                <span className="size-4 rounded-full border" style={{ background: color?.hex }} /> {color?.label ?? r.spec.color}
              </dd>
              {r.spec.material && (
                <>
                  <dt className="text-muted-foreground">Chất liệu</dt>
                  <dd>
                    {COASTER_MATERIALS.find((m) => m.key === r.spec.material)?.label ?? r.spec.material}
                    {r.spec.backing ? ` · ${COASTER_BACKINGS.find((b) => b.key === r.spec.backing)?.label ?? r.spec.backing}` : ""}
                  </dd>
                </>
              )}
              {r.spec.border && (
                <>
                  <dt className="text-muted-foreground">Viền</dt>
                  <dd>
                    {NAPKIN_BORDERS.find((b) => b.key === r.spec.border)?.label ?? r.spec.border}
                    {r.spec.borderColor ? ` · chỉ ${THREAD_COLORS.find((c) => c.key === r.spec.borderColor)?.label ?? r.spec.borderColor}` : ""}
                  </dd>
                </>
              )}
              {r.spec.shape && (
                <>
                  <dt className="text-muted-foreground">Hình dạng</dt>
                  <dd>
                    {r.spec.shape === "image" ? "Cắt theo ảnh khách" : (SHAPE_PRESETS.find((p) => p.key === r.spec.shape)?.label ?? r.spec.shape)}
                    {r.spec.shape === "image" ? ` · lề ${r.spec.shapeMarginMm ?? 0} mm${r.spec.shapeKeepBg ? " · giữ nền ảnh" : ""}${r.spec.shapeImageOnCoaster ? " · thêu luôn ảnh này" : ""}` : ""}
                  </dd>
                </>
              )}
              {r.spec.sizeMm && (
                <>
                  <dt className="text-muted-foreground">Kích thước</dt>
                  <dd>{outlineSize(r.spec.outline)}</dd>
                </>
              )}
            </dl>
            {r.spec.outline && (
              <div className="mt-3 space-y-2">
                {/* duong cat theo mm that: xuong tai ve cat vai / lam file theu vien */}
                <div className="rounded-md border bg-muted p-2" dangerouslySetInnerHTML={{ __html: outlineSvg(r.spec.outline, "100%") }} />
                <a
                  href={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(outlineSvg(r.spec.outline))}`}
                  download={`${r.code}-cut-outline.svg`}
                  className="text-sm text-primary hover:underline"
                >
                  Tải đường cắt (SVG, đơn vị mm)
                </a>
                {r.files["shape-original"] && (
                  <a href={file(r.files["shape-original"], true)} className="block text-sm text-primary hover:underline">
                    Tải ảnh gốc dùng làm hình dạng
                  </a>
                )}
              </div>
            )}
          </Section>
        </div>
      </div>
    </>
  );
}

/** Duong cat lot coc -> SVG kich thuoc that (mm), y len tren doi sang y xuong cua SVG. */
function outlineSvg(outline: [number, number][], width?: string) {
  const xs = outline.map((p) => p[0]);
  const ys = outline.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const w = (x1 - x0).toFixed(1);
  const h = (y1 - y0).toFixed(1);
  const d = outline.map(([x, y], i) => `${i ? "L" : "M"}${(x - x0).toFixed(1)},${(y1 - y).toFixed(1)}`).join(" ") + "Z";
  const size = width ? `width="${width}"` : `width="${w}mm" height="${h}mm"`;
  return `<svg xmlns="http://www.w3.org/2000/svg" ${size} viewBox="0 0 ${w} ${h}"><path d="${d}" fill="none" stroke="#c8553d" stroke-width="0.5"/></svg>`;
}

function outlineSize(outline?: [number, number][]) {
  if (!outline?.length) return "";
  const xs = outline.map((p) => p[0]);
  const ys = outline.map((p) => p[1]);
  return `${(Math.max(...xs) - Math.min(...xs)).toFixed(0)} × ${(Math.max(...ys) - Math.min(...ys)).toFixed(0)} mm`;
}
