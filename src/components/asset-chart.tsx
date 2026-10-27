"use client";

import { useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmtKrw, fmtKrwShort, fmtSigned, tone } from "@/lib/format";
import { rangeBounds, sliceRange, type RangeId } from "@/lib/range";
import { Spinner } from "./spinner";

export interface AssetPoint {
  date: string;
  value: number;
  /** 누적 시간가중수익률 */
  cum: number;
}

const RANGES = ["1M", "3M", "YTD", "1Y", "전체"] as const satisfies readonly RangeId[];

/**
 * 자산 추이: 입출금까지 반영한 총자산(주식 + 현금)과 기간 중 증감. 투자 수익률은 수익률 화면에서 본다.
 */
export function AssetChart({
  points,
  failed = false,
  withCash = false,
  bare = false,
  status = "ready",
  onRetry,
}: {
  points: AssetPoint[];
  failed?: boolean;
  withCash?: boolean;
  bare?: boolean;
  /** loading·error여도 같은 틀(머리글·기간 버튼·그래프 높이)을 그려서, 불러오는 동안과 불러온 뒤의 높이가 같다 */
  status?: "ready" | "loading" | "error";
  onRetry?: () => void;
}) {
  const [range, setRange] = useState<(typeof RANGES)[number]>("3M");
  const { data, base } = useMemo(() => {
    if (!points.length) return { data: points, base: undefined };
    const { from } = rangeBounds(range, points.at(-1)!.date);
    const r = sliceRange(points, from);
    return { data: r.points, base: r.before ?? r.points[0] };
  }, [points, range]);

  const last = data.at(-1);
  // 기간 직전 날 대비 총자산 증감 (입출금 포함: 그래프 선과 같은 값)
  const change = base && last ? last.value - base.value : 0;

  return (
    // bare: 팝업 안에서 쓸 때는 카드 테두리 없이
    <div className={bare ? "flex flex-col" : "card flex flex-col p-5"}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          {bare ? (
            // 팝업 제목이 이미 '자산 추이'라서 부가 설명만 (없어도 줄 높이는 그대로 두어 높이가 변하지 않게)
            <h2 className="text-xs text-muted">{withCash ? "주식 + 현금" : "\u00a0"}</h2>
          ) : (
            <h2 className="font-semibold">자산 추이{withCash && <span className="ml-1.5 text-xs font-normal text-muted">주식 + 현금</span>}</h2>
          )}
          {(last || status !== "ready") && (
            <p className="mt-0.5 text-xs text-ink-2">
              기간 변화{" "}
              {last && status === "ready" ? (
                <span className={`font-semibold ${tone(change)}`}>{fmtSigned(change)}</span>
              ) : (
                <span className="text-muted">-</span>
              )}
            </p>
          )}
        </div>
        {/* 휴대폰에서는 항상 아래 줄 (금액 길이에 따라 줄이 바뀌면 불러오는 중과 불러온 뒤의 높이가 달라진다) */}
        <div className="flex w-full rounded-lg bg-surface-2 p-0.5 text-xs sm:w-auto">
          {RANGES.map((r) => (
            <button
              key={r}
              disabled={status !== "ready"}
              onClick={() => setRange(r)}
              className={`flex-1 rounded-md px-2.5 py-1 font-medium disabled:cursor-default sm:flex-none ${r === range ? "bg-surface text-ink shadow-sm" : "text-ink-2"}`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
      {/* 상태와 상관없이 같은 높이의 틀 (불러오는 중 → 불러온 뒤에 박스 크기가 변하지 않게) */}
      <div className="h-60 sm:h-72">
        {status === "loading" ? (
          <div className="flex h-full items-center justify-center">
            <Spinner className="size-7" />
          </div>
        ) : status === "error" ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-muted">
            <p>자산 추이를 불러오지 못했어요.</p>
            {onRetry && (
              <button type="button" className="btn-ghost" onClick={onRetry}>
                다시 시도
              </button>
            )}
          </div>
        ) : data.length < 2 ? (
          <p className="flex h-full items-center justify-center text-sm text-muted">
            {failed ? "자산 추이를 불러오지 못했어요. 잠시 후 새로고침해 주세요." : "표시할 자산 기록이 아직 없어요"}
          </p>
        ) : (
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
                  const p = active && (payload?.[0]?.payload as AssetPoint | undefined);
                  if (!p) return null;
                  return (
                    <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-sm">
                      <div className="text-muted">{p.date}</div>
                      <div className="mt-0.5 font-semibold text-ink">
                        {withCash ? "총자산 " : "평가금액 "}
                        {fmtKrw(p.value)}
                      </div>
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
        )}
      </div>
    </div>
  );
}
