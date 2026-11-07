"use client";

import { Loader2Icon } from "lucide-react";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "@/components/ui/sonner";
import { addMoney, formatMoney, formatMoneyCompact } from "@/lib/money";
import { cn } from "@/lib/utils";

/**
 * Bieu do doanh thu (thay chart.blade.php + dashboard.js / Chart.js).
 * Doi 1 / 30 / 7 ngay goi GET ajax/order/chart?chartType=... -> { label[], data[] }.
 */
type Chart = { label: string[]; data: number[] };

const MODES = [
  { value: "1", label: "Biểu đồ năm" },
  { value: "30", label: "Tháng hiện tại" },
  { value: "7", label: "7 ngày gần nhất" },
];

/** Truc Y gon: $12.5K (tien USD, xem @/lib/money) */
const short = (v: number) => formatMoneyCompact(v);

export function RevenueChart({ initial }: { initial: Chart }) {
  const [mode, setMode] = useState("1");
  const [chart, setChart] = useState(initial);
  const [loading, setLoading] = useState(false);

  const load = async (type: string) => {
    setMode(type);
    setLoading(true);
    try {
      const res = await fetch(`/ajax/order/chart?chartType=${type}`, { headers: { "x-requested-with": "XMLHttpRequest" } });
      if (!res.ok) throw new Error(`Lỗi ${res.status}`);
      setChart(await res.json());
    } catch (e) {
      toast.error(`Không tải được biểu đồ: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const rows = chart.label.map((label, i) => ({ label, value: Number(chart.data[i] ?? 0) }));
  const total = addMoney(...rows.map((r) => r.value));

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs text-muted-foreground">Tổng doanh thu trong kỳ</div>
          <div className="text-lg font-semibold tabular-nums">{formatMoney(total)}</div>
        </div>
        <div className="inline-flex items-center gap-1 rounded-lg bg-muted p-1">
          {loading && <Loader2Icon className="mx-1 size-4 animate-spin text-muted-foreground" />}
          {MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => load(m.value)}
              disabled={loading}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground",
                mode === m.value && "bg-card text-foreground shadow-sm",
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} stroke="var(--muted-foreground)" interval="preserveStartEnd" />
            <YAxis tickLine={false} axisLine={false} fontSize={11} stroke="var(--muted-foreground)" tickFormatter={short} width={48} />
            <Tooltip
              cursor={{ fill: "var(--muted)", opacity: 0.5 }}
              formatter={(v) => [formatMoney(v), "Doanh thu"]}
              contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", fontSize: 12 }}
            />
            <Bar dataKey="value" fill="var(--primary)" radius={[4, 4, 0, 0]} maxBarSize={36} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
