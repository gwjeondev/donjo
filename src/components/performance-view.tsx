"use client";

import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmtKrw, fmtPct, fmtSigned, tone } from "@/lib/format";
import { aggregate, type DailyPoint, type PeriodRow } from "@/lib/performance";

const TABS = [
  { id: "day", label: "일별" },
  { id: "month", label: "월별" },
  { id: "year", label: "연도별" },
] as const;
type TabId = (typeof TABS)[number]["id"];

const label = (period: string, tab: TabId) =>
  tab === "day" ? period.slice(5).replace("-", ".") : tab === "month" ? `${period.slice(2, 4)}.${period.slice(5)}` : period;

export function PerformanceView({
  points,
  startValue = 0,
  failed = false,
}: {
  /** 조회 기간으로 자른 일별 자산 */
  points: DailyPoint[];
  /** 기간 직전 날의 평가금액 (첫 구간의 기초 금액) */
  startValue?: number;
  failed?: boolean;
}) {
  const [tab, setTab] = useState<TabId>("month");
  const rows = useMemo(() => aggregate(points, tab, startValue), [points, tab, startValue]);
  // 위에서 고른 조회 기간(1M·3M·YTD·1Y·전체·직접입력)의 구간을 전부 보여 준다
  const data = rows;

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
        <p className="card p-8 text-center text-sm text-muted">
          {failed ? "수익률을 불러오지 못했어요. 잠시 후 새로고침해 주세요." : "매매 기록이 생기면 수익률을 보여 드려요."}
        </p>
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

          <div className="card overflow-hidden">
            <table className="hidden w-full whitespace-nowrap text-sm xl:table">
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

            <ul className="divide-y divide-line xl:hidden">
              {[...data].reverse().map((r) => (
                <li key={r.period} className="px-4 py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm font-medium">{r.period}</span>
                    <span className={`whitespace-nowrap text-base font-semibold ${tone(r.returnRate)}`}>{fmtPct(r.returnRate)}</span>
                  </div>
                  <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <dt className="text-muted">손익</dt>
                    <dd className={`text-right ${tone(r.pnl)}`}>{fmtSigned(r.pnl)}</dd>
                    <dt className="text-muted">기말 평가금액</dt>
                    <dd className="text-right">{fmtKrw(r.endValue)}</dd>
                    <dt className="text-muted">기초 평가금액</dt>
                    <dd className="text-right text-ink-2">{fmtKrw(r.startValue)}</dd>
                    <dt className="text-muted">순투입</dt>
                    <dd className="text-right text-ink-2">{fmtSigned(r.netFlow)}</dd>
                    <dt className="text-muted">자산 증가율</dt>
                    <dd className={`text-right ${tone(r.valueChangeRate)}`}>{r.startValue > 0 ? fmtPct(r.valueChangeRate) : "-"}</dd>
                  </dl>
                </li>
              ))}
            </ul>
          </div>
          <p className="text-xs leading-relaxed text-muted">
            <b>수익률</b>은 매수·매도로 인한 돈의 유입·유출을 제외한 순수 투자 성과(시간가중수익률)이고,{" "}
            <b>자산 증가율</b>은 추가 매수까지 포함한 평가금액의 단순 증감률이에요. 손익 = 기말 − 기초 − 순투입.
          </p>
        </>
      )}
    </div>
  );
}
