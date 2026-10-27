"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { RANGE_IDS, rangeBounds, rangeQuery, type RangeId } from "@/lib/range";
import { useReload } from "./reload-region";

const RANGE_LABEL: Record<RangeId, string> = { "1M": "1M", "3M": "3M", YTD: "YTD", "1Y": "1Y", 전체: "전체", 직접: "직접입력" };
const today = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

export type Custom = { from?: string; to?: string };

/** 조회 기간 버튼 (1M · 3M · YTD · 1Y · 전체 · 직접입력). 직접입력이면 시작일·종료일 칸 */
export function RangeBar({
  range,
  custom,
  min,
  max,
  onChange,
}: {
  range: RangeId;
  custom: Custom;
  /** 직접입력 날짜의 범위 */
  min?: string;
  max?: string;
  onChange: (range: RangeId, custom: Custom) => void;
}) {
  const pick = (r: RangeId) => {
    // 직접입력을 처음 열면 올해 1월 1일 ~ 오늘로 채워 둔다
    const end = max ?? today();
    onChange(r, r === "직접" && !custom.from && !custom.to ? { from: rangeBounds("YTD", end).from, to: end } : custom);
  };
  const edit = (k: "from" | "to", v: string) => onChange(range, { ...custom, [k]: v || undefined });
  const dateInput = (k: "from" | "to", label: string) => (
    <input
      type="date"
      aria-label={label}
      className="input min-w-0 flex-1 px-2 py-1.5 sm:w-40 sm:flex-none sm:px-3 max-[359px]:text-sm"
      value={custom[k] ?? ""}
      min={min}
      max={max}
      onChange={(e) => edit(k, e.target.value)}
    />
  );
  return (
    <div className="flex w-full flex-wrap items-center gap-x-3 gap-y-2 sm:w-auto">
      <div className="flex w-full rounded-lg bg-surface-2 p-0.5 text-xs sm:w-fit" role="group" aria-label="조회 기간">
        {RANGE_IDS.map((r) => (
          <button
            key={r}
            type="button"
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
          {dateInput("from", "시작일")}
          <span className="text-muted">~</span>
          {dateInput("to", "종료일")}
        </div>
      ) : null}
    </div>
  );
}

/** 주소(?range=&from=&to=)를 바꿔 서버가 그 기간으로 다시 그리게 하는 조회 기간 버튼 */
export function RangeFilter({
  range: initialRange,
  custom: initialCustom,
  fallback,
  min,
  max,
}: {
  range: RangeId;
  custom: Custom;
  /** 주소에 기간이 없을 때의 기본값 (주소에서 생략) */
  fallback: RangeId;
  min?: string;
  max?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { start } = useReload();
  const [range, setRange] = useState(initialRange);
  const [custom, setCustom] = useState(initialCustom);
  return (
    <RangeBar
      range={range}
      custom={custom}
      min={min}
      max={max}
      onChange={(r, c) => {
        setRange(r);
        setCustom(c);
        const next = new URLSearchParams(params);
        for (const k of ["range", "from", "to"]) next.delete(k);
        for (const [k, v] of Object.entries(rangeQuery(r, c, fallback))) next.set(k, v);
        start(() => router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false }));
      }}
    />
  );
}
