"use client";

import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmtKrw, fmtPct, fmtSigned, tone } from "@/lib/format";
import { periodBounds } from "@/lib/range";
import { DetailCard, NameLink } from "./detail-card";
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
  account,
  market,
}: {
  /** 조회 기간으로 자른 일별 자산 */
  points: DailyPoint[];
  /** 기간 직전 날의 평가금액 (첫 구간의 기초 금액) */
  startValue?: number;
  failed?: boolean;
  /** 기간을 누르면 같은 조건으로 매매기록을 연다 */
  account?: string;
  market?: string;
}) {
  const tradesHref = (period: string) =>
    `/transactions?${new URLSearchParams({ ...(account ? { account } : {}), ...(market ? { market } : {}), ...periodBounds(period) })}`;
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
                  <th className="px-4 py-2.5 text-right font-medium">투자 손익</th>
                  <th className="px-4 py-2.5 text-right font-medium">수익률</th>
                  <th className="px-4 py-2.5 text-right font-medium">자산 증가율</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {[...data].reverse().map((r) => (
                  <tr key={r.period}>
                    <td className="px-4 py-2.5">
                      <NameLink href={tradesHref(r.period)} title="이 기간의 거래내역 보기" className="text-brand">
                        {r.period}
                      </NameLink>
                    </td>
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
                <DetailCard
                  key={r.period}
                  to={tradesHref(r.period)}
                  title={r.period}
                  value={fmtPct(r.returnRate)}
                  valueClass={tone(r.returnRate)}
                  rows={[
                    ["투자 손익", fmtSigned(r.pnl), tone(r.pnl)],
                    ["기말 평가금액", fmtKrw(r.endValue)],
                    ["기초 평가금액", fmtKrw(r.startValue), "text-ink-2"],
                    ["순투입", fmtSigned(r.netFlow), "text-ink-2"],
                    ["자산 증가율", r.startValue > 0 ? fmtPct(r.valueChangeRate) : "-", tone(r.valueChangeRate)],
                  ]}
                />
              ))}
            </ul>
          </div>
          <p className="text-xs leading-relaxed text-muted">
            기간을 누르면 그 기간의 거래내역을 보여 줘요. <b>수익률</b>은 매수·매도로 인한 돈의 유입·유출을 제외한 순수 투자 성과(시간가중수익률)이고,{" "}
            <b>자산 증가율</b>은 추가 매수까지 포함한 평가금액의 단순 증감률이에요. 투자 손익 = 기말 − 기초 − 순투입으로, 아직 팔지 않은 종목의 평가 변화까지 들어가요. 매도로 확정된 손익은 손익 화면에서 볼 수 있어요.
          </p>
        </>
      )}
    </div>
  );
}
