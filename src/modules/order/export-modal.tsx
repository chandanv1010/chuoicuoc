"use client";

import { format } from "date-fns";
import { DownloadIcon, FileSpreadsheetIcon, Loader2Icon } from "lucide-react";
import { useState } from "react";
import { Field } from "@/components/admin/fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form-controls";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/interactive";
import { toast } from "@/components/ui/sonner";

/**
 * Nut + modal "Xuat Excel" (order/component/filter.blade.php, customer/customer/component/filter.blade.php
 * va HT.exportExcel / HT.setupDataForExport trong library.js).
 * POST ajax/excel/export {model, startDate, endDate} -> {status, file_url, filename} roi tai file.
 */
export function ExportExcel({ title, model }: { title: string; model: "Order" | "Customer" }) {
  const today = format(new Date(), "yyyy-MM-dd");
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(today);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    if (!start || !end) {
      toast.error("Vui lòng chọn khoảng ngày");
      return;
    }
    setLoading(true);
    try {
      const body = new URLSearchParams({ model, startDate: start, endDate: end });
      const res = await fetch("/ajax/excel/export", { method: "POST", body, headers: { "x-requested-with": "XMLHttpRequest" } });
      const json = (await res.json().catch(() => null)) as { status?: string; file_url?: string; filename?: string; message?: string } | null;
      if (!res.ok || json?.status !== "success" || !json.file_url) throw new Error(json?.message || `Lỗi ${res.status}`);
      // file_url co the la URL tuyet doi theo APP_URL -> chi lay path + query de tai cung origin
      const u = new URL(json.file_url, window.location.origin);
      const link = document.createElement("a");
      link.href = u.pathname + u.search;
      link.download = json.filename ?? "";
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success("Đã xuất file Excel");
      setOpen(false);
    } catch (e) {
      toast.error(`Xuất Excel không thành công: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline">
          <FileSpreadsheetIcon /> Xuất Excel
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Chọn khoảng ngày tạo cần xuất ra file Excel.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Từ ngày" required>
            <Input type="date" value={start} max={end || undefined} onChange={(e) => setStart(e.target.value)} />
          </Field>
          <Field label="Đến ngày" required>
            <Input type="date" value={end} min={start || undefined} onChange={(e) => setEnd(e.target.value)} />
          </Field>
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            Hủy
          </Button>
          <Button type="button" variant="success" onClick={run} disabled={loading}>
            {loading ? <Loader2Icon className="animate-spin" /> : <DownloadIcon />} Xuất Excel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
