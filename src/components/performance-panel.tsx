"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { BenchmarkChart } from "@/components/benchmark-chart";
import { PerformanceView } from "@/components/performance-view";
import type { BenchmarkPoint, DailyPoint } from "@/lib/performance";
import { rangeBounds, rangeQuery, sliceRange, type RangeId } from "@/lib/range";
import { RangeBar } from "./range-bar";
import { FilterRow } from "./filter-row";
import { MarketFilter, type MarketGroup } from "./market-filter";
import { ReloadRegion, useReload } from "./reload-region";

const dot = (d: string) => d.replaceAll("-", ".");

/**
 * 조회 기간을 고르면 주소(?range=&from=&to=)를 바꿔 서버가 그 기간의 데이터만 새로 계산한다.
 * 시장 비교 차트와 기간별 수익률에 함께 적용한다.
 */
export function PerformancePanel({
  accounts,
  account,
  market,
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
  market?: MarketGroup;
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
  const { pending, start } = useReload();
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
    start(() => router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false }));
  };

  const view = useMemo(() => {
    // 받아 둔 데이터는 처음 고른 기간 부근부터만 있다. 더 긴 기간을 고르면 새 데이터가 올 때까지
    // 잘린 값(예: 3M인데 1M치 수익률)을 보여 주지 않고 이전 기간 화면을 그대로 둔다 (그동안 로딩 효과)
    const wanted = last ? rangeBounds(range, last, custom) : {};
    const start = daily[0]?.date;
    const need = wanted.from && first && wanted.from > first ? wanted.from : first;
    const covered = !start || !need || start <= need;
    const { from, to } = covered ? wanted : last ? rangeBounds(initialRange, last, initialCustom) : {};
    const d = sliceRange(daily, from, to);
    const b = sliceRange(benchmark, from, to);
    return { from, to, daily: d.points, startValue: d.before?.value ?? 0, benchmark: b.points, base: b.before };
  }, [daily, benchmark, range, custom, last, first, initialRange, initialCustom]);

  return (
    <div className="space-y-4" aria-busy={pending}>
      <FilterRow accounts={accounts} account={account} extra={<MarketFilter value={market} />}>
        {daily.length >= 2 && <RangeBar range={range} custom={custom} min={first} max={last} onChange={go} />}
      </FilterRow>

      {daily.length >= 2 && view.daily.length === 0 ? (
        <p className="card p-8 text-center text-sm text-muted">
          선택한 기간에는 기록이 없어요. {first && last && `${dot(first)} ~ ${dot(last)} 사이로 골라 주세요.`}
        </p>
      ) : (
        // 기간·계좌·시장을 바꿔 새로 계산하는 동안: 내용 전체 위에 어두운 막과 가운데 스피너 (앱 공통 로딩 동작)
        <ReloadRegion className="space-y-4">
          <BenchmarkChart points={daily.length >= 2 ? view.benchmark : benchmark} base={view.base} missing={missing} failed={failed} />
          <PerformanceView points={view.daily} startValue={view.startValue} failed={failed} account={account} market={market} />
        </ReloadRegion>
      )}
    </div>
  );
}
