"use client";

import { format, parse } from "date-fns";
import { CalendarIcon, XIcon } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/form-controls";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/interactive";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

/**
 * Phan client cua order/index (thay .rangepicker + HT.updateBadge trong order.js).
 */

/** "m/d/Y - m/d/Y" (dinh dang daterangepicker ma OrderRepository::scopeCustomerCreatedAt doc) <-> 2 ngay Y-m-d. */
function splitRange(v: string): [string, string] {
  const [a, b] = v.split("-").map((x) => x.trim());
  const toYmd = (s: string | undefined) => {
    if (!s) return "";
    const d = parse(s, "M/d/yyyy", new Date());
    return Number.isNaN(d.getTime()) ? "" : format(d, "yyyy-MM-dd");
  };
  return [toYmd(a), toYmd(b)];
}
const toMdy = (ymd: string) => (ymd ? format(parse(ymd, "yyyy-MM-dd", new Date()), "MM/dd/yyyy") : "");
const toDmy = (ymd: string) => (ymd ? format(parse(ymd, "yyyy-MM-dd", new Date()), "dd/MM/yyyy") : "");

/** O loc khoang ngay tao: gui `created_at` = "m/d/Y - m/d/Y" trong form GET. */
export function DateRangeFilter({ defaultValue }: { defaultValue: string }) {
  const [init0, init1] = splitRange(defaultValue);
  const [start, setStart] = useState(init0);
  const [end, setEnd] = useState(init1);
  const [open, setOpen] = useState(false);
  const hidden = useRef<HTMLInputElement>(null);
  const value = start && end ? `${toMdy(start)} - ${toMdy(end)}` : "";
  const label = start && end ? `${toDmy(start)} → ${toDmy(end)}` : "Chọn khoảng ngày";
  return (
    <>
      <input ref={hidden} type="hidden" name="created_at" value={value} />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" className={cn("w-56 justify-start font-normal", !value && "text-muted-foreground")}>
            <CalendarIcon /> <span className="truncate">{label}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-3" align="start">
          <div className="grid gap-3">
            <label className="grid gap-1 text-xs font-medium">
              Từ ngày
              <Input type="date" value={start} max={end || undefined} onChange={(e) => setStart(e.target.value)} />
            </label>
            <label className="grid gap-1 text-xs font-medium">
              Đến ngày
              <Input type="date" value={end} min={start || undefined} onChange={(e) => setEnd(e.target.value)} />
            </label>
            <div className="flex justify-between gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setStart("");
                  setEnd("");
                }}
              >
                <XIcon /> Xóa
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={Boolean(start) !== Boolean(end)}
                onClick={() => {
                  setOpen(false);
                  // doi state cap nhat input hidden roi moi gui form loc
                  setTimeout(() => hidden.current?.form?.requestSubmit(), 0);
                }}
              >
                Áp dụng
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </>
  );
}

/**
 * O doi Thanh toan / Giao hang tren tung dong (HT.updateBadge):
 * don dang 'pending' (chua xac nhan) thi bao loi, nguoc lai POST ajax/order/update {id, payload[field]}.
 */
export function OrderBadgeSelect({
  id,
  field,
  value,
  confirm,
  options,
  onChanged,
}: {
  id: string;
  field: "payment" | "delivery";
  value: string;
  confirm: string;
  options: [string, string][];
  onChanged?: (value: string) => void;
}) {
  const [current, setCurrent] = useState(value);
  const [pending, setPending] = useState(false);
  const tone: Record<string, string> = {
    paid: "text-success",
    success: "text-success",
    processing: "text-blue-600",
    failed: "text-destructive",
    unpaid: "text-amber-700",
    pending: "text-amber-700",
  };
  const change = async (next: string) => {
    if (confirm === "pending") {
      toast.error("Bạn phải xác nhận đơn hàng trước khi thực hiện cập nhật này");
      return;
    }
    const prev = current;
    setCurrent(next);
    setPending(true);
    try {
      const body = new URLSearchParams({ id, [`payload[${field}]`]: next });
      const res = await fetch("/ajax/order/update", { method: "POST", body, headers: { "x-requested-with": "XMLHttpRequest" } });
      const json = (await res.json().catch(() => null)) as { error?: number; messages?: string } | null;
      if (json?.error === 10) {
        toast.success("Cập nhật trạng thái thành công");
        onChanged?.(next);
      }
      else {
        setCurrent(prev);
        toast.error(json?.messages || "Có vấn đề xảy ra! Hãy thử lại");
      }
    } catch {
      setCurrent(prev);
      toast.error("Có vấn đề xảy ra! Hãy thử lại");
    } finally {
      setPending(false);
    }
  };
  return (
    <NativeSelect value={current} disabled={pending} onChange={(e) => change(e.target.value)} className={cn("h-8 w-40 text-xs font-medium", tone[current])} aria-label={field}>
      {options.map(([k, label]) => (
        <option key={k} value={k}>
          {label}
        </option>
      ))}
    </NativeSelect>
  );
}
