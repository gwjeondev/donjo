"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmtKrw, fmtPct, fmtSigned, tone } from "@/lib/format";
import { aggregate, summarizeRange, type DailyPoint, type PeriodRow, type SeriesGroup } from "@/lib/performance";
import { sliceRange } from "@/lib/range";

const TABS = [
  { id: "day", label: "일별", limit: 60, column: "기간" },
  { id: "month", label: "월별", limit: 36, column: "기간" },
  { id: "year", label: "연도별", limit: Infinity, column: "기간" },
  { id: "stock", label: "종목별", limit: Infinity, column: "종목" },
  { id: "account", label: "계좌별", limit: Infinity, column: "계좌" },
] as const;
type TabId = (typeof TABS)[number]["id"];
const isPeriod = (t: TabId): t is "day" | "month" | "year" => t === "day" || t === "month" || t === "year";

/** 표·차트의 한 줄: 기간 하나, 또는 종목·계좌 하나 */
interface Item {
  key: string;
  label: string;
  sub?: string;
  href?: string;
  row: Omit<PeriodRow, "period">;
}

const periodLabel = (period: string, tab: TabId) =>
  tab === "day" ? period.slice(5).replace("-", ".") : tab === "month" ? `${period.slice(2, 4)}.${period.slice(5)}` : period;
const short = (s: string) => (s.length > 10 ? `${s.slice(0, 9)}…` : s);

export function PerformanceView({
  points,
  startValue = 0,
  limited = true,
  from,
  to,
  byStock = [],
  byAccount = [],
  failed = false,
}: {
  /** 조회 기간으로 자른 일별 자산 */
  points: DailyPoint[];
  /** 기간 직전 날의 평가금액 (첫 구간의 기초 금액) */
  startValue?: number;
  /** 전체 기간일 때만 최근 N개로 줄여 보여 준다 */
  limited?: boolean;
  /** 조회 기간 (종목별·계좌별 계산용) */
  from?: string;
  to?: string;
  byStock?: SeriesGroup[];
  byAccount?: SeriesGroup[];
  failed?: boolean;
}) {
  // 계좌를 하나 골라 보고 있으면 계좌별은 의미가 없어 숨긴다
  const tabs = TABS.filter((t) => t.id !== "account" || byAccount.length > 0);
  const [picked, setTab] = useState<TabId>("month");
  const tab = tabs.some((t) => t.id === picked) ? picked : "month";
  const { limit, column } = TABS.find((t) => t.id === tab)!;

  // items: 표 순서(기간은 최신순, 종목·계좌는 손익 큰 순), chart: 차트 순서
  const { items, chart } = useMemo(() => {
    if (isPeriod(tab)) {
      const rows = aggregate(points, tab, startValue);
      const shown = limited ? rows.slice(-limit) : rows;
      const chart: Item[] = shown.map(({ period, ...row }) => ({ key: period, label: period, row }));
      return { chart, items: [...chart].reverse() };
    }
    const groups = tab === "stock" ? byStock : byAccount;
    const items: Item[] = groups
      .flatMap((g) => {
        const r = sliceRange(g.points, from, to);
        // 이 기간에 보유하지도 거래하지도 않았으면 뺀다
        if (r.points.length === 0 || (!r.before?.value && r.points.every((p) => !p.value && !p.flow))) return [];
        return [{ key: g.key, label: g.label, sub: g.sub, href: g.href, row: summarizeRange(r.points, r.before?.value ?? 0) }];
      })
      .sort((a, b) => b.row.pnl - a.row.pnl);
    return { items, chart: items };
  }, [tab, points, startValue, limited, limit, byStock, byAccount, from, to]);

  const horizontal = !isPeriod(tab);
  const data = chart.map((it) => ({ ...it, returnRate: it.row.returnRate }));

  return (
    <div className="space-y-4">
      <div className="flex rounded-lg bg-surface-2 p-0.5 text-sm sm:w-fit">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 whitespace-nowrap rounded-md px-1 py-1.5 font-medium sm:flex-none sm:px-4 ${t.id === tab ? "bg-surface text-ink shadow-sm" : "text-ink-2"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {data.length === 0 ? (
        <p className="card p-8 text-center text-sm text-muted">
          {failed
            ? "수익률을 불러오지 못했어요. 잠시 후 새로고침해 주세요."
            : horizontal && points.length > 0
              ? `선택한 기간에 보유하거나 거래한 ${column}이 없어요.`
              : "매매 기록이 생기면 수익률을 보여 드려요."}
        </p>
      ) : (
        <>
          <div className="card p-5">
            <h2 className="mb-3 font-semibold">{column === "기간" ? "기간별" : `${column}별`} 수익률</h2>
            {/* 종목·계좌는 이름이 길어 가로 막대로 */}
            <div style={{ height: horizontal ? Math.max(120, data.length * 32 + 24) : 224 }}>
              <ResponsiveContainer>
                <BarChart
                  data={data}
                  layout={horizontal ? "vertical" : "horizontal"}
                  margin={{ top: 4, right: horizontal ? 12 : 4, left: 0, bottom: 0 }}
                >
                  <CartesianGrid vertical={horizontal} horizontal={!horizontal} stroke="var(--border)" />
                  {/* Recharts는 Fragment 안의 축을 못 찾으므로 하나씩 조건부로 둔다 */}
                  <XAxis
                    {...(horizontal
                      ? { type: "number" as const, tickFormatter: (v: number) => `${(v * 100).toFixed(0)}%` }
                      : { dataKey: "key", tickFormatter: (p: string) => periodLabel(p, tab), minTickGap: 16 })}
                    tick={{ fontSize: 11, fill: "var(--muted)" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    {...(horizontal
                      ? {
                          type: "category" as const,
                          dataKey: "key",
                          tickFormatter: (k: string) => short(data.find((d) => d.key === k)?.label ?? k),
                          width: 108,
                          interval: 0,
                        }
                      : { tickFormatter: (v: number) => `${(v * 100).toFixed(0)}%`, width: 44 })}
                    tick={{ fontSize: 11, fill: horizontal ? "var(--ink-2)" : "var(--muted)" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <ReferenceLine {...(horizontal ? { x: 0 } : { y: 0 })} stroke="var(--muted)" />
                  <Tooltip
                    cursor={{ fill: "var(--surface-2)" }}
                    content={({ active, payload }) => {
                      const it = active && (payload?.[0]?.payload as Item | undefined);
                      if (!it) return null;
                      return (
                        <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-sm">
                          <div className="text-muted">{it.label}</div>
                          <div className={`mt-0.5 font-semibold ${tone(it.row.returnRate)}`}>{fmtPct(it.row.returnRate)}</div>
                          <div className={tone(it.row.pnl)}>{fmtSigned(it.row.pnl)}</div>
                          <div className="text-ink-2">기말 {fmtKrw(it.row.endValue)}</div>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="returnRate" radius={[4, 4, 4, 4]} maxBarSize={horizontal ? 18 : 28} isAnimationActive={false}>
                    {data.map((d) => (
                      <Cell key={d.key} fill={d.returnRate >= 0 ? "var(--up)" : "var(--down)"} />
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
                  <th className="px-4 py-2.5 text-left font-medium">{column}</th>
                  <th className="px-4 py-2.5 text-right font-medium">기초 평가금액</th>
                  <th className="px-4 py-2.5 text-right font-medium">기말 평가금액</th>
                  <th className="px-4 py-2.5 text-right font-medium">순투입</th>
                  <th className="px-4 py-2.5 text-right font-medium">손익</th>
                  <th className="px-4 py-2.5 text-right font-medium">수익률</th>
                  <th className="px-4 py-2.5 text-right font-medium">자산 증가율</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {items.map(({ key, row: r, ...it }) => (
                  <tr key={key}>
                    <td className="max-w-56 px-4 py-2.5 text-ink-2">
                      <Name {...it} />
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
              {items.map(({ key, row: r, ...it }) => (
                <li key={key} className="px-4 py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 text-sm font-medium">
                      <Name {...it} />
                    </span>
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
            {horizontal && " 종목별·계좌별 수익률은 선택한 기간 전체를 그 종목(계좌)만 따로 계산했어요."}
          </p>
        </>
      )}
    </div>
  );
}

/** 기간 이름, 또는 종목·계좌 이름(누르면 해당 화면으로) */
function Name({ label, sub, href }: Omit<Item, "key" | "row">) {
  const name = href ? (
    <Link href={href} className="font-medium text-ink hover:underline">
      {label}
    </Link>
  ) : (
    label
  );
  if (!sub) return name;
  return (
    <span className="block min-w-0">
      <span className="block truncate">{name}</span>
      <span className="block text-xs font-normal text-muted">{sub}</span>
    </span>
  );
}
