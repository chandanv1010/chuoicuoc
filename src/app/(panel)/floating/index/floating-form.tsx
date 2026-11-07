"use client";

import { ArrowDown, ArrowUp, Loader2, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { FloatingButtons, KindIcon } from "@/components/site/floating-buttons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/form-controls";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import { saveFloatingAction } from "@/modules/floating/actions";
import { buttonHref, KIND_INFO, type FloatingButton, type FloatingConfig, type FloatingKind } from "@/modules/floating/config";

/** Form cau hinh nut lien he noi + khung xem truoc truc tiep (bam thu duoc, form khong gui that). */
export function FloatingForm({ initial }: { initial: FloatingConfig }) {
  const [c, setC] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(JSON.stringify(initial));
  const dirty = JSON.stringify(c) !== saved;
  const set = <K extends keyof FloatingConfig>(k: K, v: FloatingConfig[K]) => setC((x) => ({ ...x, [k]: v }));
  const setBtn = (id: string, patch: Partial<FloatingButton>) => setC((x) => ({ ...x, buttons: x.buttons.map((b) => (b.id === id ? { ...b, ...patch } : b)) }));
  const move = (i: number, d: number) =>
    setC((x) => {
      const list = [...x.buttons];
      const j = i + d;
      if (j < 0 || j >= list.length) return x;
      [list[i], list[j]] = [list[j], list[i]];
      return { ...x, buttons: list };
    });
  const add = (kind: FloatingKind) =>
    setC((x) => ({ ...x, buttons: [...x.buttons, { id: `b${Date.now().toString(36)}`, kind, enabled: true, side: "right", value: "", label: "", color: "" }] }));

  const save = async () => {
    setSaving(true);
    try {
      await saveFloatingAction(c);
      setSaved(JSON.stringify(c));
      toast.success(c.enabled ? "Đã lưu — nút đang hiện trên website." : "Đã lưu — nút đang tắt trên website.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
      <div className="grid min-w-0 gap-5">
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
            <Switch checked={c.enabled} onChange={(v) => set("enabled", v)} label={c.enabled ? "Đang bật trên website" : "Đang tắt — bật để hiện trên mọi trang"} strong />
            <Button type="button" onClick={save} disabled={saving || !dirty}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              {dirty ? "Lưu lại" : "Đã lưu"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Các nút</CardTitle>
              <CardDescription>Mỗi nút chọn bên trái hoặc bên phải màn hình. Thứ tự từ trên xuống; nút đầu tiên mỗi bên có hiệu ứng gọi chú ý.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3">
            {c.buttons.map((b, i) => {
              const info = KIND_INFO[b.kind];
              const missing = info.valueLabel && !buttonHref(b);
              return (
                <div key={b.id} className={cn("rounded-lg border p-3", !b.enabled && "opacity-60")}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="grid size-8 shrink-0 place-items-center rounded-full text-white" style={{ background: b.color || info.color }}>
                      <KindIcon kind={b.kind} size={16} />
                    </span>
                    <span className="mr-auto text-sm font-medium">{info.label}</span>
                    <Segment
                      value={b.side}
                      onChange={(side) => setBtn(b.id, { side })}
                      options={[
                        { value: "left", label: "Trái" },
                        { value: "right", label: "Phải" },
                      ]}
                    />
                    <Switch checked={b.enabled} onChange={(enabled) => setBtn(b.id, { enabled })} label="Hiện" />
                    <IconBtn title="Lên" onClick={() => move(i, -1)} disabled={i === 0}>
                      <ArrowUp className="size-4" />
                    </IconBtn>
                    <IconBtn title="Xuống" onClick={() => move(i, 1)} disabled={i === c.buttons.length - 1}>
                      <ArrowDown className="size-4" />
                    </IconBtn>
                    <IconBtn title="Xóa nút" onClick={() => setC((x) => ({ ...x, buttons: x.buttons.filter((y) => y.id !== b.id) }))}>
                      <Trash2 className="size-4" />
                    </IconBtn>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_120px]">
                    {info.valueLabel ? (
                      <Field label={info.valueLabel} error={missing && b.value ? "Chưa đúng định dạng" : missing ? "Nhập để nút hiện" : undefined}>
                        <Input value={b.value} placeholder={info.placeholder} onChange={(e) => setBtn(b.id, { value: e.target.value })} />
                      </Field>
                    ) : (
                      <p className="self-end pb-2 text-xs text-muted-foreground">
                        {b.kind === "form" ? "Mở hộp thoại form; tin gửi về QL Liên hệ." : "Cuộn mượt lên đầu trang."}
                      </p>
                    )}
                    <Field label="Chữ khi rê chuột">
                      <Input value={b.label} placeholder={info.defaultLabel} onChange={(e) => setBtn(b.id, { label: e.target.value })} />
                    </Field>
                    <Field label="Màu nền">
                      <div className="flex items-center gap-2">
                        <input type="color" value={b.color || info.color} onChange={(e) => setBtn(b.id, { color: e.target.value })} className="h-9 w-10 cursor-pointer rounded border bg-transparent" />
                        {b.color && (
                          <button type="button" onClick={() => setBtn(b.id, { color: "" })} className="text-xs text-muted-foreground hover:text-foreground">
                            Mặc định
                          </button>
                        )}
                      </div>
                    </Field>
                  </div>
                </div>
              );
            })}
            <div className="flex flex-wrap gap-2">
              {(Object.keys(KIND_INFO) as FloatingKind[]).map((k) => (
                <button key={k} type="button" onClick={() => add(k)} className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs hover:border-primary hover:text-primary">
                  <Plus className="size-3.5" /> {KIND_INFO[k].label}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Kiểu dáng & vị trí</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Hình dạng">
              <Segment
                value={c.shape}
                onChange={(v) => set("shape", v)}
                options={[
                  { value: "circle", label: "Tròn" },
                  { value: "rounded", label: "Bo góc" },
                  { value: "square", label: "Vuông" },
                ]}
              />
            </Field>
            <Field label="Chữ cạnh nút">
              <Segment
                value={c.labels}
                onChange={(v) => set("labels", v)}
                options={[
                  { value: "hover", label: "Khi rê chuột" },
                  { value: "always", label: "Luôn hiện" },
                  { value: "never", label: "Không" },
                ]}
              />
            </Field>
            <Field label="Hiệu ứng gọi chú ý">
              <Segment
                value={c.attention}
                onChange={(v) => set("attention", v)}
                options={[
                  { value: "pulse", label: "Sóng lan" },
                  { value: "bounce", label: "Nảy" },
                  { value: "none", label: "Không" },
                ]}
              />
            </Field>
            <Range label="Cỡ nút" value={c.size} min={36} max={80} onChange={(v) => set("size", v)} />
            <Range label="Khoảng cách giữa nút" value={c.gap} min={0} max={40} onChange={(v) => set("gap", v)} />
            <Range label="Cách mép dưới" value={c.bottom} min={0} max={300} onChange={(v) => set("bottom", v)} />
            <Range label="Cách mép bên" value={c.offset} min={0} max={200} onChange={(v) => set("offset", v)} />
            <div className="grid gap-2 sm:col-span-2">
              <Switch checked={c.shadow} onChange={(v) => set("shadow", v)} label="Đổ bóng" />
              <Switch checked={c.topAfterScroll} onChange={(v) => set("topAfterScroll", v)} label="Nút “Lên đầu trang” chỉ hiện khi đã cuộn xuống" />
              <Switch checked={c.hideOnMobile} onChange={(v) => set("hideOnMobile", v)} label="Ẩn trên điện thoại" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Form liên hệ</CardTitle>
              <CardDescription>Hộp thoại mở ra khi khách bấm nút “Form liên hệ”. Có chặn spam như trang Contact; tin nhắn vào QL Liên hệ.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Tiêu đề">
              <Input value={c.form.title} onChange={(e) => set("form", { ...c.form, title: e.target.value })} />
            </Field>
            <Field label="Chữ nút gửi">
              <Input value={c.form.submit} onChange={(e) => set("form", { ...c.form, submit: e.target.value })} />
            </Field>
            <Field label="Dòng phụ" className="sm:col-span-2">
              <Input value={c.form.subtitle} onChange={(e) => set("form", { ...c.form, subtitle: e.target.value })} />
            </Field>
            <Field label="Thông báo gửi thành công" className="sm:col-span-2">
              <Input value={c.form.success} onChange={(e) => set("form", { ...c.form, success: e.target.value })} />
            </Field>
            <div className="grid gap-2 sm:col-span-2">
              <p className="text-xs text-muted-foreground">Luôn hỏi tên và số điện thoại.</p>
              <Switch checked={c.form.askEmail} onChange={(v) => set("form", { ...c.form, askEmail: v })} label="Hỏi email" />
              <Switch checked={c.form.askMessage} onChange={(v) => set("form", { ...c.form, askMessage: v })} label="Ô lời nhắn" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="xl:sticky xl:top-4 xl:self-start">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Xem trước</CardTitle>
              <CardDescription>Bấm thử các nút; form ở đây không gửi thật.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="relative h-[560px] overflow-hidden rounded-lg border bg-[#f4efe6]">
              <div className="space-y-3 p-5" aria-hidden="true">
                <div className="h-8 w-2/3 rounded bg-black/10" />
                <div className="h-40 rounded-lg bg-black/5" />
                <div className="h-3 w-full rounded bg-black/10" />
                <div className="h-3 w-5/6 rounded bg-black/10" />
                <div className="h-3 w-4/6 rounded bg-black/10" />
                <div className="grid grid-cols-3 gap-3 pt-2">
                  <div className="h-24 rounded-lg bg-black/5" />
                  <div className="h-24 rounded-lg bg-black/5" />
                  <div className="h-24 rounded-lg bg-black/5" />
                </div>
              </div>
              <FloatingButtons config={c} preview />
              {!c.enabled && <p className="absolute top-2 right-2 rounded-full bg-black/70 px-2.5 py-1 text-[11px] text-white">Đang tắt trên website</p>}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Field({ label, error, className, children }: { label: string; error?: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("grid min-w-0 gap-1.5", className)}>
      <Label className="text-xs">{label}</Label>
      {children}
      {error && <p className="text-xs text-amber-600">{error}</p>}
    </div>
  );
}

function Segment<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex rounded-lg bg-muted p-0.5 text-xs">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn("rounded-md px-2.5 py-1.5 whitespace-nowrap", value === o.value ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:text-foreground")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Switch({ checked, onChange, label, strong }: { checked: boolean; onChange: (v: boolean) => void; label: string; strong?: boolean }) {
  return (
    <label className={cn("inline-flex cursor-pointer items-center gap-2 text-sm", strong && "font-medium")}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn("relative h-5 w-9 shrink-0 rounded-full transition-colors", checked ? "bg-primary" : "bg-muted-foreground/30")}
      >
        <span className={cn("absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow transition-transform", checked && "translate-x-4")} />
      </button>
      {label}
    </label>
  );
}

function Range({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <Field label={`${label}: ${value}px`}>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className="accent-primary" />
    </Field>
  );
}

function IconBtn({ title, onClick, disabled, children }: { title: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" title={title} aria-label={title} onClick={onClick} disabled={disabled} className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30">
      {children}
    </button>
  );
}

