"use client";

import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmtPct, tone } from "@/lib/format";
import type { BenchmarkPoint } from "@/lib/performance";

const SERIES = [
  { key: "mine", label: "내 투자", color: "var(--series-1)", width: 2.5 },
  { key: "kospi", label: "코스피", color: "var(--series-2)", width: 1.75 },
  { key: "sp500", label: "S&P 500", color: "var(--series-3)", width: 1.75 },
] as const;

const RANGES = [
  { id: "1M", days: 31 },
  { id: "3M", days: 92 },
  { id: "1Y", days: 366 },
  { id: "전체", days: Infinity },
] as const;

/** 같은 기간 내 수익률(입출금 제외)과 시장 지수 비교. 선택한 기간의 시작을 0%로 맞춘다 */
export function BenchmarkChart({
  points,
  missing = [],
  failed = false,
}: {
  points: BenchmarkPoint[];
  /** 시세를 불러오지 못한 지수 (예: ["kospi"]) */
  missing?: string[];
  failed?: boolean;
}) {
  const [range, setRange] = useState<(typeof RANGES)[number]["id"]>("전체");
  const data = useMemo(() => {
    if (points.length === 0) return [];
    const days = RANGES.find((r) => r.id === range)!.days;
    const last = new Date(points.at(-1)!.date).getTime();
    const sliced =
      days === Infinity ? points : points.filter((p) => last - new Date(p.date).getTime() <= days * 86400000);
    const base = sliced[0];
    return sliced.map((p) => {
      const row: Record<string, number | string> = { date: p.date };
      for (const s of SERIES) row[s.key] = Number(p[s.key]) / Number(base[s.key]) - 1;
      return row;
    });
  }, [points, range]);

  const series = SERIES.filter((s) => !missing.includes(s.key));

  if (points.length < 2) {
    return (
      <div className="card p-5">
        <h2 className="font-semibold">시장 대비 수익률</h2>
        <p className="mt-3 text-sm text-ink-2">
          {failed
            ? "수익률을 불러오지 못했습니다. 잠시 후 새로고침해 주세요."
            : points.length === 0
              ? "매매 기록이 생기면 코스피·S&P 500과 비교해 보여 드려요."
              : "비교하려면 이틀 이상의 기록이 필요해요. 매매 기록의 거래일이 모두 같은 날이라면, 실제로 매수한 날짜로 고쳐 주세요. 그날부터 지금까지의 수익률을 시장과 비교해 드려요."}
        </p>
      </div>
    );
  }
  const last = data.at(-1)!;

  return (
    <div className="card p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-semibold">시장 대비 수익률</h2>
          <p className="mt-0.5 text-xs text-muted">입출금 제외 · 선택한 기간 시작을 0%로 맞춤</p>
        </div>
        <div className="flex rounded-lg bg-surface-2 p-0.5 text-xs">
          {RANGES.map((r) => (
            <button
              key={r.id}
              onClick={() => setRange(r.id)}
              className={`rounded-md px-2.5 py-1 font-medium ${r.id === range ? "bg-surface text-ink shadow-sm" : "text-ink-2"}`}
            >
              {r.id}
            </button>
          ))}
        </div>
      </div>
      {/* 범례 겸 기간 수익률 (색만으로 구분하지 않도록 이름과 값을 함께) */}
      <ul className="mb-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
        {series.map((s) => (
          <li key={s.key} className="flex items-center gap-1.5 whitespace-nowrap">
            <span className="h-0.5 w-4 rounded" style={{ background: s.color, height: s.width }} />
            <span className="text-ink-2">{s.label}</span>
            <span className={`font-semibold ${tone(Number(last[s.key]))}`}>{fmtPct(Number(last[s.key]))}</span>
          </li>
        ))}
      </ul>
      {missing.length > 0 && (
        <p className="mb-2 text-xs text-muted">
          {SERIES.filter((s) => missing.includes(s.key)).map((s) => s.label).join(", ")} 시세를 불러오지 못해 제외했어요.
        </p>
      )}
      <div className="h-60">
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="date"
              tickFormatter={(d: string) => d.slice(2).replaceAll("-", ".")}
              tick={{ fontSize: 11, fill: "var(--muted)" }}
              tickLine={false}
              axisLine={false}
              minTickGap={40}
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
              cursor={{ stroke: "var(--muted)", strokeDasharray: "3 3" }}
              content={({ active, payload }) => {
                const p = active && (payload?.[0]?.payload as Record<string, number | string> | undefined);
                if (!p) return null;
                return (
                  <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-sm">
                    <div className="text-muted">{String(p.date)}</div>
                    {series.map((s) => (
                      <div key={s.key} className="mt-0.5 flex items-center justify-between gap-4">
                        <span className="flex items-center gap-1.5 text-ink-2">
                          <span className="size-2 rounded-full" style={{ background: s.color }} />
                          {s.label}
                        </span>
                        <span className={`font-medium ${tone(Number(p[s.key]))}`}>{fmtPct(Number(p[s.key]))}</span>
                      </div>
                    ))}
                  </div>
                );
              }}
            />
            {series.map((s) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                stroke={s.color}
                strokeWidth={s.width}
                dot={false}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
