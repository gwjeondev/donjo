"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { fmtKrw } from "@/lib/format";

/** 올해 월별 받은 배당 (세후, 원화) */
export function DividendMonthly({ year, months, count }: { year: string; months: number[]; count: number }) {
  const total = months.reduce((s, v) => s + v, 0);
  const data = months.map((value, i) => ({ month: `${i + 1}월`, value }));
  return (
    <div className="card p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3">
        <h2 className="font-semibold">{year}년 배당</h2>
        <p className="text-sm text-ink-2">
          세후 <span className="font-semibold text-up">+{fmtKrw(total)}</span> · {count}건
        </p>
      </div>
      <div className="h-40">
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--muted)" }} tickLine={false} axisLine={false} interval={0} tickFormatter={(m: string) => m.replace("월", "")} />
            <Tooltip
              cursor={{ fill: "var(--surface-2)" }}
              content={({ active, payload }) => {
                const p = active && (payload?.[0]?.payload as { month: string; value: number } | undefined);
                if (!p) return null;
                return (
                  <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-sm">
                    <div className="text-muted">{p.month}</div>
                    <div className="mt-0.5 font-semibold text-ink">{fmtKrw(p.value)}</div>
                  </div>
                );
              }}
            />
            <Bar dataKey="value" fill="var(--series-1)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
