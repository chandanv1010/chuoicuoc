/* eslint-disable @next/next/no-img-element -- anh qua route co kiem tra quyen */
import { CpuIcon, DownloadIcon, PrinterIcon } from "lucide-react";
import { Section } from "@/components/admin/page";
import { Button } from "@/components/ui/button";
import { MACHINE_FORMATS, type MachineReport } from "./machine";
import type { DesignRequest } from "./requests";

/** Khoi "File may theu" o trang thiet ke khach gui: nut tao file, xem truoc, bang doi chi, tai DST/PES/EXP/JEF. */
export function MachineSection({ r, report }: { r: DesignRequest; report: MachineReport | null }) {
  const f = (name: string, download = false) => `/design-request/${r.id}/machine/${name}${download ? "?download=1" : ""}`;
  const v = report?.generated_at ? `?v=${encodeURIComponent(report.generated_at)}` : "";
  return (
    <Section
      title="File máy thêu"
      description="Ghép các hình/chữ đúng vị trí, kích thước, góc xoay khách đặt; digitize tự động ra file máy và bảng đổi chỉ. Thợ kiểm tra lại (mở design.svg bằng Inkscape + Ink/Stitch, hoặc DST trong Wilcom/Hatch) trước khi chạy máy."
    >
      <form action={`/design-request/${r.id}/digitize`} method="post" className="flex flex-wrap items-end gap-4 rounded-lg border p-3 text-sm">
        <fieldset className="flex flex-wrap gap-3">
          <legend className="mb-1 text-xs text-muted-foreground">Định dạng</legend>
          {MACHINE_FORMATS.map((m) => (
            <label key={m.key} className="flex items-center gap-1.5" title={m.note}>
              <input type="checkbox" name="formats[]" value={m.key} defaultChecked={m.key === "dst" || m.key === "pes"} className="size-4" /> {m.label}
            </label>
          ))}
        </fieldset>
        <label className="grid gap-1">
          <span className="text-xs text-muted-foreground">Số màu chỉ tối đa</span>
          <input type="number" name="max_colors" min={1} max={12} defaultValue={report?.max_colors ?? 8} className="h-9 w-20 rounded-md border px-2" />
        </label>
        <Button type="submit">
          <CpuIcon /> {report ? "Tạo lại file máy" : "Tạo file máy thêu"}
        </Button>
        <span className="text-xs text-muted-foreground">Mất khoảng 20–60 giây.</span>
      </form>

      {report && (
        <div className="grid gap-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {[
              ["composite.png", "Thiết kế ghép (đúng tỉ lệ)"],
              ["preview.png", "Mô phỏng mũi thêu"],
              ["on-fabric.png", "Trên vải"],
            ].map(([n, label]) => (
              <a key={n} href={f(n) + v} target="_blank" rel="noreferrer" className="block">
                <img src={f(n) + v} alt={label} className="w-full rounded-lg border bg-[repeating-conic-gradient(#eee_0_25%,#fff_0_50%)] bg-[length:16px_16px] object-contain" />
                <span className="mt-1 block text-center text-xs text-muted-foreground">{label}</span>
              </a>
            ))}
          </div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm md:grid-cols-4">
            <dt className="text-muted-foreground">Kích thước thêu</dt>
            <dd>
              {report.width_mm} × {report.height_mm} mm
            </dd>
            <dt className="text-muted-foreground">Số mũi</dt>
            <dd>{report.stitches.toLocaleString("en-US")}</dd>
            <dt className="text-muted-foreground">Đổi chỉ / cắt chỉ</dt>
            <dd>
              {report.stops.length} / {report.trims}
            </dd>
            <dt className="text-muted-foreground">Thời gian máy</dt>
            <dd>~{report.est_minutes} phút</dd>
            {report.placement && (
              <>
                <dt className="text-muted-foreground">Tâm thêu so với tâm lót cốc</dt>
                <dd>
                  {fmtOffset(report.placement.offset_mm)} (lót cốc {report.placement.coaster_mm.join(" × ")} mm)
                </dd>
              </>
            )}
          </dl>
          <StopsTable stops={report.stops} />
          <Warnings report={report} />
          <div className="flex flex-wrap gap-2">
            {report.files.map((n) => (
              <Button key={n} asChild variant={n.endsWith(".svg") ? "outline" : "default"} size="sm">
                <a href={f(n, true)}>
                  <DownloadIcon /> {n.replace("design.", "").toUpperCase()}
                  {n.endsWith(".svg") ? " (Ink/Stitch)" : ""}
                </a>
              </Button>
            ))}
            <Button asChild variant="outline" size="sm">
              <a href={`/design-request/${r.id}/worksheet`} target="_blank" rel="noreferrer">
                <PrinterIcon /> In phiếu thêu
              </a>
            </Button>
          </div>
        </div>
      )}
    </Section>
  );
}

export function StopsTable({ stops }: { stops: MachineReport["stops"] }) {
  return (
    <table className="w-full max-w-xl border-collapse text-sm">
      <thead>
        <tr className="border-b text-left text-xs text-muted-foreground">
          <th className="py-1 pr-2">Lần</th>
          <th className="py-1 pr-2">Màu</th>
          <th className="py-1 pr-2">Mã chỉ</th>
          <th className="py-1 pr-2">Tên</th>
          <th className="py-1">Hex</th>
        </tr>
      </thead>
      <tbody>
        {stops.map((s) => (
          <tr key={s.stop} className="border-b">
            <td className="py-1 pr-2 font-medium">{s.stop}</td>
            <td className="py-1 pr-2">
              <span className="inline-block size-5 rounded border align-middle" style={{ background: s.hex }} />
            </td>
            <td className="py-1 pr-2 font-mono">{s.code}</td>
            <td className="py-1 pr-2">{s.name}</td>
            <td className="py-1 font-mono text-xs">{s.hex}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function Warnings({ report }: { report: MachineReport }) {
  const w: string[] = [];
  for (const t of report.thin_warnings) w.push(`Chỉ ${t.thread}: ${Math.round(t.thin_share * 100)}% là nét mảnh (< 1.5 mm) — dễ đứt/lem, nên làm dày hoặc đổi chạy chỉ.`);
  if (report.low_contrast.length) w.push(`Màu chỉ gần màu vải, khó nhìn: ${report.low_contrast.join(", ")}.`);
  if (report.placement?.items.some((i) => i.kind === "text" && i.size_mm[1] < 10))
    w.push("Có chữ cao dưới 10 mm: chữ được chuyển từ ảnh, nét mảnh có thể mất. Nên thay bằng font thêu (Ink/Stitch Lettering) trước khi chạy.");
  w.push("Bảng mã chỉ hiện là bảng tạm (T001…): đối chiếu sang mã chỉ thật của xưởng (Madeira / Isacord…) theo màu hex.");
  return (
    <ul className="list-disc space-y-0.5 pl-5 text-xs text-amber-700">
      {w.map((x) => (
        <li key={x}>{x}</li>
      ))}
    </ul>
  );
}

export function fmtOffset([x, y]: [number, number]) {
  const h = Math.abs(x) < 0.5 ? "giữa" : `${x > 0 ? "phải" : "trái"} ${Math.abs(x)} mm`;
  const v = Math.abs(y) < 0.5 ? "giữa" : `${y > 0 ? "lên" : "xuống"} ${Math.abs(y)} mm`;
  return h === "giữa" && v === "giữa" ? "đúng tâm" : `${h}, ${v}`;
}
