"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useReload } from "./reload-region";

export type MarketGroup = "kr" | "us";

const OPTIONS: { value: MarketGroup | ""; label: string }[] = [
  { value: "", label: "전체" },
  { value: "kr", label: "국내" },
  { value: "us", label: "해외" },
];

/** 국내(코스피·코스닥) / 해외(미국) 구분 필터. 주소의 ?market= 으로 유지한다 */
export function MarketFilter({ value }: { value?: MarketGroup }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { start } = useReload();
  return (
    <div role="radiogroup" aria-label="국내/해외 구분" className="flex shrink-0 rounded-lg bg-surface-2 p-0.5 text-sm">
      {OPTIONS.map((o) => {
        const active = (value ?? "") === o.value;
        return (
          <button
            key={o.label}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => {
              const next = new URLSearchParams(params);
              if (o.value) next.set("market", o.value);
              else next.delete("market");
              start(() => router.push(`${pathname}?${next}`));
            }}
            className={`whitespace-nowrap rounded-md px-3 py-1.5 font-medium transition ${
              active ? "bg-surface text-ink shadow-sm" : "text-ink-2 hover:text-ink"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
