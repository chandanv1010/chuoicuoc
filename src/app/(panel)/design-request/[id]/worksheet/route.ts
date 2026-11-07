import { COASTER_MATERIALS, coasterColor, NAPKIN_BORDERS, THREAD_COLORS } from "@/modules/design/config";
import { machineReport } from "@/modules/design/machine";
import { getDesignRequest } from "@/modules/design/requests";
import { authorizeHandler } from "@/server/auth";

/**
 * GET /design-request/<id>/worksheet — phieu theu in A4 cho tho: anh xem truoc, kich thuoc, vi tri dat khung,
 * thu tu doi chi (ma + mau), canh bao. HTML don (khong layout admin) de in thang.
 */
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await authorizeHandler(req, "order.index");
  if (admin instanceof Response) return admin;
  const { id } = await params;
  const r = await getDesignRequest(id);
  const rep = r && (await machineReport(r));
  if (!r || !rep) return new Response("Chưa có file máy cho thiết kế này. Bấm “Tạo file máy thêu” ở trang chi tiết trước.", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });

  const img = (n: string) => `/design-request/${r.id}/machine/${n}?v=${encodeURIComponent(rep.generated_at ?? "")}`;
  const fabric = coasterColor(r.spec.material, r.spec.color);
  const material = COASTER_MATERIALS.find((m) => m.key === r.spec.material)?.label ?? r.spec.material ?? "";
  const border = NAPKIN_BORDERS.find((b) => b.key === r.spec.border)?.label ?? "";
  const borderThread = THREAD_COLORS.find((c) => c.key === r.spec.borderColor)?.label ?? "";
  const off = rep.placement?.offset_mm ?? [0, 0];
  const offTxt = Math.abs(off[0]) < 0.5 && Math.abs(off[1]) < 0.5 ? "đúng tâm" : `${off[0] >= 0 ? "phải" : "trái"} ${Math.abs(off[0])} mm, ${off[1] >= 0 ? "lên" : "xuống"} ${Math.abs(off[1])} mm`;
  const rows = rep.stops
    .map((s) => `<tr><td>${s.stop}</td><td><span class="sw" style="background:${esc(s.hex)}"></span></td><td class="mono">${esc(s.code)}</td><td>${esc(s.name)}</td><td class="mono">${esc(s.hex)}</td><td class="chk"></td></tr>`)
    .join("");
  const items = (rep.placement?.items ?? [])
    .map((i) => `<li>${i.kind === "text" ? `Chữ “${esc(i.text)}”` : "Hình"} — ${i.size_mm.join(" × ")} mm, xoay ${i.rotation}°, tâm (${i.center_mm.join(", ")}) mm</li>`)
    .join("");
  const warns = [
    ...rep.thin_warnings.map((t) => `Chỉ ${esc(t.thread)}: ${Math.round(t.thin_share * 100)}% nét mảnh &lt; 1.5 mm`),
    ...(rep.low_contrast.length ? [`Chỉ gần màu vải: ${esc(rep.low_contrast.join(", "))}`] : []),
    ...((rep.placement?.items ?? []).some((i) => i.kind === "text" && i.size_mm[1] < 10) ? ["Chữ cao &lt; 10 mm: nên thay bằng font thêu trước khi chạy"] : []),
  ];

  const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Phiếu thêu ${esc(r.code)}</title>
<style>
  @page { size: A4; margin: 12mm }
  body { font: 13px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif; color: #111; margin: 0; padding: 16px; background: #fff }
  h1 { font-size: 20px; margin: 0 0 2px } .muted { color: #666 } .mono { font-family: ui-monospace, Consolas, monospace }
  .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 12px 0 }
  .grid figure { margin: 0; border: 1px solid #ddd; border-radius: 6px; padding: 6px; text-align: center }
  .grid img { width: 100%; height: 180px; object-fit: contain } figcaption { font-size: 11px; color: #666 }
  dl { display: grid; grid-template-columns: 170px 1fr; gap: 3px 12px; margin: 8px 0 }
  dt { color: #555 } dd { margin: 0 }
  table { border-collapse: collapse; width: 100%; margin: 8px 0 } th, td { border: 1px solid #ccc; padding: 5px 8px; text-align: left } th { background: #f5f5f5; font-size: 12px }
  .sw { display: inline-block; width: 28px; height: 18px; border: 1px solid #999; border-radius: 3px; vertical-align: middle }
  .chk { width: 70px } .warn { color: #8a5300 } .noprint { margin-bottom: 12px }
  @media print { .noprint { display: none } body { padding: 0 } }
</style></head><body>
<div class="noprint"><button onclick="window.print()">In phiếu</button></div>
<h1>Phiếu thêu ${esc(r.code)}</h1>
<div class="muted">Khách: ${esc(r.customer.name)} · Số lượng: ${r.customer.quantity} · Gửi: ${esc(new Date(r.created_at).toLocaleString("vi-VN"))} · File: ${esc(rep.files.join(", "))}</div>
<div class="grid">
  <figure><img src="${img("composite.png")}" alt=""><figcaption>Thiết kế ghép (đúng tỉ lệ)</figcaption></figure>
  <figure><img src="${img("preview.png")}" alt=""><figcaption>Mô phỏng mũi thêu</figcaption></figure>
  <figure><img src="${img("on-fabric.png")}" alt=""><figcaption>Trên vải</figcaption></figure>
</div>
<dl>
  <dt>Sản phẩm</dt><dd>Lót cốc ${esc(material)} · màu ${esc(fabric?.label ?? r.spec.color)} ${fabric ? `<span class="sw" style="background:${esc(fabric.hex)}"></span>` : ""}</dd>
  <dt>Kích thước lót cốc</dt><dd>${esc(rep.placement?.coaster_mm.join(" × "))} mm · hình ${esc(r.spec.shape)}</dd>
  <dt>Viền</dt><dd>${esc(border)}${borderThread ? ` · chỉ ${esc(borderThread)}` : ""}</dd>
  <dt>Vùng thêu</dt><dd><b>${rep.width_mm} × ${rep.height_mm} mm</b></dd>
  <dt>Đặt khung (tâm thêu)</dt><dd>${offTxt} so với tâm lót cốc</dd>
  <dt>Số mũi / thời gian</dt><dd>${rep.stitches.toLocaleString("en-US")} mũi · ~${rep.est_minutes} phút · ${rep.trims} lần cắt chỉ</dd>
</dl>
<h3>Thứ tự đổi chỉ</h3>
<table><thead><tr><th>Lần</th><th>Màu</th><th>Mã chỉ</th><th>Tên</th><th>Hex</th><th>Đã lắp</th></tr></thead><tbody>${rows}</tbody></table>
<h3>Chi tiết các hình</h3><ul>${items}</ul>
${warns.length ? `<h3>Lưu ý</h3><ul class="warn">${warns.map((w) => `<li>${w}</li>`).join("")}</ul>` : ""}
<p class="muted">Mã chỉ T001… là bảng tạm; đối chiếu sang mã chỉ thật của xưởng theo màu hex. File DST không lưu màu, chỉ lưu lần đổi chỉ — lắp chỉ theo bảng trên.</p>
</body></html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store" } });
}
