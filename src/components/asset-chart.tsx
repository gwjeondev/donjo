"use client";

import { useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmtKrw, fmtKrwShort, fmtPct, tone } from "@/lib/format";

interface Point {
  date: string;
  value: number;
  /** 누적 시간가중수익률 */
  cum: number;
}

const RANGES = [
  { id: "1M", days: 31 },
  { id: "3M", days: 92 },
  { id: "1Y", days: 366 },
  { id: "전체", days: Infinity },
] as const;

export function AssetChart({ points }: { points: Point[] }) {
  const [range, setRange] = useState<(typeof RANGES)[number]["id"]>("3M");
  const data = useMemo(() => {
    const days = RANGES.find((r) => r.id === range)!.days;
    if (!points.length || days === Infinity) return points;
    const last = new Date(points.at(-1)!.date).getTime();
    return points.filter((p) => last - new Date(p.date).getTime() <= days * 86400000);
  }, [points, range]);

  const first = data[0];
  const last = data.at(-1);
  const periodReturn = first && last ? (1 + last.cum) / (1 + first.cum) - 1 : 0;

  return (
    <div className="card flex h-full flex-col p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-semibold">자산 추이</h2>
          {last && (
            <p className="mt-0.5 text-xs text-ink-2">
              기간 수익률 <span className={`font-semibold ${tone(periodReturn)}`}>{fmtPct(periodReturn)}</span>
              <span className="text-muted"> (입출금 제외)</span>
            </p>
          )}
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
      {data.length < 2 ? (
        <p className="flex flex-1 items-center justify-center py-16 text-sm text-muted">표시할 자산 기록이 아직 없습니다</p>
      ) : (
        <div className="h-60 min-h-60 xl:h-auto xl:flex-1" /* 옆 카드(자산 비중)가 더 길면 그 높이만큼 늘어난다 */>
          <ResponsiveContainer>
            <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="assetFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--series-1)" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="var(--series-1)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis
                dataKey="date"
                tickFormatter={(d: string) => d.slice(5).replace("-", ".")}
                tick={{ fontSize: 11, fill: "var(--muted)" }}
                tickLine={false}
                axisLine={false}
                minTickGap={40}
              />
              <YAxis
                tickFormatter={fmtKrwShort}
                tick={{ fontSize: 11, fill: "var(--muted)" }}
                tickLine={false}
                axisLine={false}
                width={52}
                domain={["auto", "auto"]}
              />
              <Tooltip
                cursor={{ stroke: "var(--muted)", strokeDasharray: "3 3" }}
                content={({ active, payload }) => {
                  const p = active && (payload?.[0]?.payload as Point | undefined);
                  if (!p) return null;
                  return (
                    <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-sm">
                      <div className="text-muted">{p.date}</div>
                      <div className="mt-0.5 font-semibold text-ink">{fmtKrw(p.value)}</div>
                      <div className={tone(p.cum)}>누적 {fmtPct(p.cum)}</div>
                    </div>
                  );
                }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="var(--series-1)"
                strokeWidth={2}
                fill="url(#assetFill)"
                isAnimationActive={false}
                activeDot={{ r: 4, stroke: "var(--surface)", strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
