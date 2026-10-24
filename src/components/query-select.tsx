"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

/** 주소의 쿼리값 하나를 바꾸는 선택 상자 (예: ?year=2025). 빈 값이면 쿼리를 지운다 */
export function QuerySelect({
  name,
  value,
  options,
  label,
}: {
  name: string;
  value: string;
  options: { value: string; label: string }[];
  label: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return (
    <select
      aria-label={label}
      className="input w-auto shrink-0"
      value={value}
      onChange={(e) => {
        const next = new URLSearchParams(params);
        if (e.target.value) next.set(name, e.target.value);
        else next.delete(name);
        router.push(`${pathname}${next.size ? `?${next}` : ""}`);
      }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/** 주소의 쿼리값으로 고르는 탭 (예: ?tab=dividend). 첫 탭이 기본이라 쿼리를 지운다 */
export function QueryTabs({ name, value, tabs }: { name: string; value: string; tabs: { value: string; label: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return (
    <div role="tablist" className="flex rounded-lg bg-surface-2 p-0.5 text-sm sm:w-fit">
      {tabs.map((t, i) => (
        <button
          key={t.value}
          role="tab"
          aria-selected={t.value === value}
          onClick={() => {
            const next = new URLSearchParams(params);
            if (i === 0) next.delete(name);
            else next.set(name, t.value);
            router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
          }}
          className={`flex-1 rounded-md px-4 py-1.5 font-medium sm:flex-none ${t.value === value ? "bg-surface text-ink shadow-sm" : "text-ink-2"}`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
