"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { BenchmarkChart } from "@/components/benchmark-chart";
import { PerformanceView } from "@/components/performance-view";
import type { BenchmarkPoint, DailyPoint } from "@/lib/performance";
import { rangeBounds, rangeQuery, sliceRange, type RangeId } from "@/lib/range";
import { RangeBar } from "./range-bar";
import { FilterRow, StatCard } from "./filter-row";
import { fmtKrw, fmtPct, fmtSigned, tone } from "@/lib/format";
import Link from "next/link";

const dot = (d: string) => d.replaceAll("-", ".");

/**
 * 조회 기간을 고르면 주소(?range=&from=&to=)를 바꿔 서버가 그 기간의 데이터만 새로 계산한다.
 * 시장 비교 차트와 기간별 수익률에 함께 적용한다.
 */
export function PerformancePanel({
  accounts,
  account,
  range: initialRange,
  custom: initialCustom,
  firstTrade,
  daily,
  benchmark,
  missing,
  failed,
}: {
  accounts: { id: string; name: string }[];
  account?: string;
  range: RangeId;
  custom: { from?: string; to?: string };
  firstTrade?: string;
  daily: DailyPoint[];
  benchmark: BenchmarkPoint[];
  missing: string[];
  failed: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  // 누르자마자 버튼이 바뀌도록 화면 상태를 먼저 바꾸고, 데이터는 뒤따라 받는다
  const [range, setRange] = useState(initialRange);
  const [custom, setCustom] = useState(initialCustom);

  const first = firstTrade ?? daily[0]?.date;
  const last = daily.at(-1)?.date;

  const go = (r: RangeId, c: { from?: string; to?: string }) => {
    setRange(r);
    setCustom(c);
    const next = new URLSearchParams(params);
    for (const k of ["range", "from", "to"]) next.delete(k);
    for (const [k, v] of Object.entries(rangeQuery(r, c))) next.set(k, v);
    startTransition(() => router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false }));
  };

  const view = useMemo(() => {
    const { from, to } = last ? rangeBounds(range, last, custom) : {};
    const d = sliceRange(daily, from, to);
    const b = sliceRange(benchmark, from, to);
    return { from, to, daily: d.points, startValue: d.before?.value ?? 0, benchmark: b.points, base: b.before };
  }, [daily, benchmark, range, custom, last]);

  // 요약 (모두 '성과·자산' 지표. 확정된 금액은 손익 화면): 기간 수익률, 자산 증가율, 평가금액
  const stats = useMemo(() => {
    let growth = 1;
    let netFlow = 0;
    for (const p of view.daily) {
      growth *= 1 + p.ret;
      netFlow += p.flow;
    }
    const end = view.daily.at(-1)?.value ?? 0;
    return { rate: growth - 1, growthRate: view.startValue > 0 ? (end - view.startValue) / view.startValue : null, end, netFlow };
  }, [view]);
  // 손익 화면도 같은 계좌·기간으로 열리게
  const incomeHref = `/income?${new URLSearchParams({ ...(account ? { account } : {}), ...rangeQuery(range, custom) })}`;

  const shown = view.daily.length ? `${dot(view.daily[0].date)} ~ ${dot(view.daily.at(-1)!.date)}` : null;

  return (
    <div className="space-y-4" aria-busy={pending}>
      <FilterRow accounts={accounts} account={account}>
        {daily.length >= 2 && <RangeBar range={range} custom={custom} min={first} max={last} shown={shown} onChange={go} />}
      </FilterRow>

      {view.daily.length >= 2 && (
        <div className={`grid grid-cols-1 gap-3 transition-opacity sm:grid-cols-3 ${pending ? "opacity-50" : ""}`}>
          <StatCard label="기간 수익률" value={fmtPct(stats.rate)} valueClass={tone(stats.rate)} sub="입출금 제외 (시간가중)" />
          <StatCard
            label="자산 증가율"
            value={stats.growthRate == null ? "-" : fmtPct(stats.growthRate)}
            valueClass={stats.growthRate == null ? "" : tone(stats.growthRate)}
            sub="추가 매수까지 포함한 평가금액 증감"
          />
          <StatCard
            label="평가금액"
            value={fmtKrw(stats.end)}
            sub={
              <>
                순투입 {fmtSigned(stats.netFlow)} ·{" "}
                <Link href={incomeHref} className="text-brand hover:underline">
                  확정 손익 보기 →
                </Link>
              </>
            }
          />
        </div>
      )}

      {daily.length >= 2 && view.daily.length === 0 ? (
        <p className="card p-8 text-center text-sm text-muted">
          선택한 기간에는 기록이 없어요. {first && last && `${dot(first)} ~ ${dot(last)} 사이로 골라 주세요.`}
        </p>
      ) : (
        <div className={`space-y-4 transition-opacity ${pending ? "opacity-50" : ""}`}>
          <BenchmarkChart
            points={daily.length >= 2 ? view.benchmark : benchmark}
            base={view.base}
            missing={missing}
            failed={failed}
          />
          <PerformanceView
            points={view.daily}
            startValue={view.startValue}
            failed={failed}
          />
        </div>
      )}
    </div>
  );
}
