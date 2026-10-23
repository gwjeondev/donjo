"use client";

import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { BenchmarkChart } from "@/components/benchmark-chart";
import { PerformanceView } from "@/components/performance-view";
import type { BenchmarkPoint, DailyPoint } from "@/lib/performance";
import { RANGE_IDS, rangeBounds, sliceRange, type RangeId } from "@/lib/range";

const RANGE_LABEL: Record<RangeId, string> = { "1M": "1M", "3M": "3M", YTD: "YTD", "1Y": "1Y", 전체: "전체", 직접: "직접입력" };
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const dot = (d: string) => d.replaceAll("-", ".");

/** 조회 기간을 고르면 시장 비교 차트와 기간별 수익률에 함께 적용한다. 새로고침해도 유지되도록 주소(?range=&from=&to=)에 남긴다 */
export function PerformancePanel({
  daily,
  benchmark,
  missing,
  failed,
}: {
  daily: DailyPoint[];
  benchmark: BenchmarkPoint[];
  missing: string[];
  failed: boolean;
}) {
  const params = useSearchParams();
  const initial = params.get("range") === "custom" ? "직접" : params.get("range");
  const [range, setRange] = useState<RangeId>(RANGE_IDS.includes(initial as RangeId) ? (initial as RangeId) : "전체");
  const [custom, setCustom] = useState(() => {
    const valid = (k: string) => (DATE.test(params.get(k) ?? "") ? params.get(k)! : undefined);
    return { from: valid("from"), to: valid("to") };
  });

  const first = daily[0]?.date;
  const last = daily.at(-1)?.date;

  const save = (r: RangeId, c: { from?: string; to?: string }) => {
    const next = new URLSearchParams(window.location.search);
    for (const k of ["range", "from", "to"]) next.delete(k);
    if (r !== "전체") next.set("range", r === "직접" ? "custom" : r);
    if (r === "직접") for (const k of ["from", "to"] as const) if (c[k]) next.set(k, c[k]!);
    const qs = next.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
  };
  const pick = (r: RangeId) => {
    // 직접입력을 처음 열면 올해 1월 1일 ~ 오늘로 채워 둔다
    const c = r === "직접" && !custom.from && !custom.to && last ? { from: rangeBounds("YTD", last).from, to: last } : custom;
    setRange(r);
    setCustom(c);
    save(r, c);
  };
  const edit = (k: "from" | "to", v: string) => {
    const c = { ...custom, [k]: v || undefined };
    setCustom(c);
    save(range, c);
  };

  const view = useMemo(() => {
    const { from, to } = last ? rangeBounds(range, last, custom) : {};
    const d = sliceRange(daily, from, to);
    const b = sliceRange(benchmark, from, to);
    return { from, to, daily: d.points, startValue: d.before?.value ?? 0, benchmark: b.points, base: b.before };
  }, [daily, benchmark, range, custom, last]);

  const shown = view.daily.length ? `${dot(view.daily[0].date)} ~ ${dot(view.daily.at(-1)!.date)}` : null;

  return (
    <div className="space-y-4">
      {daily.length >= 2 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <div className="flex w-full rounded-lg bg-surface-2 p-0.5 text-xs sm:w-fit" role="group" aria-label="조회 기간">
            {RANGE_IDS.map((r) => (
              <button
                key={r}
                onClick={() => pick(r)}
                aria-pressed={r === range}
                className={`flex-1 whitespace-nowrap rounded-md px-2.5 py-1.5 font-medium sm:flex-none ${r === range ? "bg-surface text-ink shadow-sm" : "text-ink-2"}`}
              >
                {RANGE_LABEL[r]}
              </button>
            ))}
          </div>
          {range === "직접" ? (
            <div className="flex w-full items-center gap-1.5 sm:w-auto sm:gap-2">
              <input
                type="date"
                aria-label="시작일"
                className="input min-w-0 flex-1 px-2 py-1.5 sm:w-40 sm:flex-none sm:px-3 max-[359px]:text-sm"
                value={custom.from ?? ""}
                min={first}
                max={last}
                onChange={(e) => edit("from", e.target.value)}
              />
              <span className="text-muted">~</span>
              <input
                type="date"
                aria-label="종료일"
                className="input min-w-0 flex-1 px-2 py-1.5 sm:w-40 sm:flex-none sm:px-3 max-[359px]:text-sm"
                value={custom.to ?? ""}
                min={first}
                max={last}
                onChange={(e) => edit("to", e.target.value)}
              />
            </div>
          ) : (
            shown && <span className="text-xs text-muted">{shown}</span>
          )}
        </div>
      )}

      {daily.length >= 2 && view.daily.length === 0 ? (
        <p className="card p-8 text-center text-sm text-muted">
          선택한 기간에는 기록이 없어요. {first && last && `${dot(first)} ~ ${dot(last)} 사이로 골라 주세요.`}
        </p>
      ) : (
        <>
          <BenchmarkChart
            points={daily.length >= 2 ? view.benchmark : benchmark}
            base={view.base}
            missing={missing}
            failed={failed}
          />
          <PerformanceView
            points={view.daily}
            startValue={view.startValue}
            limited={range === "전체"}
            failed={failed}
          />
        </>
      )}
    </div>
  );
}
