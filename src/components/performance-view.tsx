"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmtKrw, fmtPct, fmtSigned, tone } from "@/lib/format";
import type { PeriodRow } from "@/lib/performance";

const TABS = [
  { id: "day", label: "일별", limit: 60 },
  { id: "month", label: "월별", limit: 36 },
  { id: "year", label: "연도별", limit: Infinity },
] as const;
type TabId = (typeof TABS)[number]["id"];

const label = (period: string, tab: TabId) =>
  tab === "day" ? period.slice(5).replace("-", ".") : tab === "month" ? `${period.slice(2, 4)}.${period.slice(5)}` : period;

export function PerformanceView({ rows }: { rows: Record<TabId, PeriodRow[]> }) {
  const [tab, setTab] = useState<TabId>("month");
  const { limit } = TABS.find((t) => t.id === tab)!;
  const data = rows[tab].slice(-limit);

  return (
    <div className="space-y-4">
      <div className="flex rounded-lg bg-surface-2 p-0.5 text-sm sm:w-fit">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 rounded-md px-4 py-1.5 font-medium sm:flex-none ${t.id === tab ? "bg-surface text-ink shadow-sm" : "text-ink-2"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {data.length === 0 ? (
        <p className="card p-8 text-center text-sm text-muted">매매 기록이 생기면 수익률이 표시됩니다.</p>
      ) : (
        <>
          <div className="card p-5">
            <h2 className="mb-3 font-semibold">기간별 수익률</h2>
            <div className="h-56">
              <ResponsiveContainer>
                <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="var(--border)" />
                  <XAxis
                    dataKey="period"
                    tickFormatter={(p: string) => label(p, tab)}
                    tick={{ fontSize: 11, fill: "var(--muted)" }}
                    tickLine={false}
                    axisLine={false}
                    minTickGap={16}
                  />
                  <YAxis
                    tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
                    tick={{ fontSize: 11, fill: "var(--muted)" }}
                    tickLine={false}
                    axisLine={false}
                    width={44}
                  />
                  <ReferenceLine y={0} stroke="var(--muted)" />
                  <Tooltip
                    cursor={{ fill: "var(--surface-2)" }}
                    content={({ active, payload }) => {
                      const r = active && (payload?.[0]?.payload as PeriodRow | undefined);
                      if (!r) return null;
                      return (
                        <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-sm">
                          <div className="text-muted">{r.period}</div>
                          <div className={`mt-0.5 font-semibold ${tone(r.returnRate)}`}>{fmtPct(r.returnRate)}</div>
                          <div className={tone(r.pnl)}>{fmtSigned(r.pnl)}</div>
                          <div className="text-ink-2">기말 {fmtKrw(r.endValue)}</div>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="returnRate" radius={[4, 4, 4, 4]} maxBarSize={28} isAnimationActive={false}>
                    {data.map((r) => (
                      <Cell key={r.period} fill={r.returnRate >= 0 ? "var(--up)" : "var(--down)"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="border-b border-line bg-surface-2 text-xs text-ink-2">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium">기간</th>
                  <th className="px-4 py-2.5 text-right font-medium">기초 평가금액</th>
                  <th className="px-4 py-2.5 text-right font-medium">기말 평가금액</th>
                  <th className="px-4 py-2.5 text-right font-medium">순투입</th>
                  <th className="px-4 py-2.5 text-right font-medium">손익</th>
                  <th className="px-4 py-2.5 text-right font-medium">수익률</th>
                  <th className="px-4 py-2.5 text-right font-medium">자산 증가율</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {[...data].reverse().map((r) => (
                  <tr key={r.period}>
                    <td className="px-4 py-2.5 text-ink-2">{r.period}</td>
                    <td className="px-4 py-2.5 text-right">{fmtKrw(r.startValue)}</td>
                    <td className="px-4 py-2.5 text-right font-medium">{fmtKrw(r.endValue)}</td>
                    <td className="px-4 py-2.5 text-right text-ink-2">{fmtSigned(r.netFlow)}</td>
                    <td className={`px-4 py-2.5 text-right ${tone(r.pnl)}`}>{fmtSigned(r.pnl)}</td>
                    <td className={`px-4 py-2.5 text-right font-medium ${tone(r.returnRate)}`}>{fmtPct(r.returnRate)}</td>
                    <td className={`px-4 py-2.5 text-right ${tone(r.valueChangeRate)}`}>
                      {r.startValue > 0 ? fmtPct(r.valueChangeRate) : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs leading-relaxed text-muted">
            <b>수익률</b>은 매수·매도로 인한 돈의 유입·유출을 제외한 순수 투자 성과(시간가중수익률)이고,{" "}
            <b>자산 증가율</b>은 추가 매수까지 포함한 평가금액의 단순 증감률입니다. 손익 = 기말 − 기초 − 순투입.
          </p>
        </>
      )}
    </div>
  );
}
