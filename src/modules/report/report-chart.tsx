"use client";

import { formatMoney, formatMoneyCompact } from "@/lib/money";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

/** Bieu do cot doanh thu cho trang bao cao (ban goc chi co bang; bieu do dung cung du lieu). */
export function ReportChart({ data }: { data: { label: string; revenue: number }[] }) {
  const short = (n: number) => formatMoneyCompact(n);
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} interval="preserveStartEnd" />
          <YAxis tickLine={false} axisLine={false} fontSize={12} width={56} tickFormatter={short} />
          <Tooltip
            cursor={{ fill: "var(--color-muted, #f4f4f5)" }}
            formatter={(v) => [formatMoney(v), "Doanh thu"]}
            contentStyle={{ borderRadius: 8, fontSize: 12 }}
          />
          <Bar dataKey="revenue" fill="var(--color-primary, #2563eb)" radius={[4, 4, 0, 0]} maxBarSize={48} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
