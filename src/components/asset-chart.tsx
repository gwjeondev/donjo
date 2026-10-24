"use client";

import { useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmtKrw, fmtKrwShort, fmtPct, tone } from "@/lib/format";
import { rangeBounds, sliceRange, type RangeId } from "@/lib/range";

interface Point {
  date: string;
  value: number;
  /** 누적 시간가중수익률 */
  cum: number;
}

const RANGES = ["1M", "3M", "YTD", "1Y", "전체"] as const satisfies readonly RangeId[];

/**
 * 자산 추이: 금액은 입출금까지 반영한 총자산(주식 + 현금), 기간 수익률은 입출금을 뺀 투자 성과.
 */
export function AssetChart({ points, failed = false, withCash = false }: { points: Point[]; failed?: boolean; withCash?: boolean }) {
  const [range, setRange] = useState<(typeof RANGES)[number]>("3M");
  const { data, base } = useMemo(() => {
    if (!points.length) return { data: points, base: undefined };
    const { from } = rangeBounds(range, points.at(-1)!.date);
    const r = sliceRange(points, from);
    return { data: r.points, base: r.before ?? r.points[0] };
  }, [points, range]);

  const last = data.at(-1);
  // 수익률 화면과 같게 기간 직전 날을 기준으로 잡는다
  const periodReturn = base && last && 1 + base.cum > 0 ? (1 + last.cum) / (1 + base.cum) - 1 : 0;

  return (
    <div className="card flex h-full flex-col p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-semibold">
            자산 추이{withCash && <span className="ml-1.5 text-xs font-normal text-muted">주식 + 현금</span>}
          </h2>
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
              key={r}
              onClick={() => setRange(r)}
              className={`rounded-md px-2.5 py-1 font-medium ${r === range ? "bg-surface text-ink shadow-sm" : "text-ink-2"}`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
      {data.length < 2 ? (
        <p className="flex flex-1 items-center justify-center py-16 text-sm text-muted">
          {failed ? "자산 추이를 불러오지 못했어요. 잠시 후 새로고침해 주세요." : "표시할 자산 기록이 아직 없어요"}
        </p>
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
                      <div className="mt-0.5 font-semibold text-ink">
                        {withCash ? "총자산 " : "평가금액 "}
                        {fmtKrw(p.value)}
                      </div>
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
