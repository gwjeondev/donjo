"use client";

import { dirLabel, type Sort, type SortDir } from "@/lib/prefs";
import { SortIcon } from "./icons";

/** 정렬 기준(select) + 방향 전환 버튼. 목록 위에서도, 설정 화면에서도 쓴다 */
export function SortControl<K extends string>({
  options,
  value,
  onChange,
  label = "정렬",
  className = "",
}: {
  options: Record<K, string>;
  value: Sort<K>;
  onChange: (next: Sort<K>) => void;
  label?: string;
  className?: string;
}) {
  const flip: SortDir = value.dir === "desc" ? "asc" : "desc";
  return (
    <div className={`flex shrink-0 items-center gap-1 ${className}`}>
      <select
        aria-label={`${label} 기준`}
        className="input w-auto shrink-0 py-1.5 pr-7 text-sm"
        value={value.key}
        onChange={(e) => {
          const key = e.target.value as K;
          // 이름·만든 순은 가나다/오래된 순이, 숫자는 높은 순이 자연스러운 첫 방향
          onChange({ key, dir: key === "name" || key === "created" ? "asc" : "desc" });
        }}
      >
        {(Object.keys(options) as K[]).map((k) => (
          <option key={k} value={k}>
            {options[k]}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => onChange({ ...value, dir: flip })}
        title={dirLabel(value.key, value.dir)}
        aria-label={`${label} 방향: ${dirLabel(value.key, value.dir)} (누르면 ${dirLabel(value.key, flip)})`}
        className="btn-ghost shrink-0 gap-1 px-2 py-1.5 text-xs"
      >
        <SortIcon className={`size-4 transition-transform ${value.dir === "asc" ? "-scale-y-100" : ""}`} />
        <span className="hidden sm:inline">{dirLabel(value.key, value.dir)}</span>
      </button>
    </div>
  );
}
