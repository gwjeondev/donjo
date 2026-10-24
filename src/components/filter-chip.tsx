import Link from "next/link";
import { CloseIcon } from "./icons";

/** 걸려 있는 조건 표시 (예: 종목 상세에서 넘어온 종목). ✕를 누르면 그 조건만 빼고 다시 연다 */
export function FilterChip({ label, value, params, name }: { label: string; value: string; params: Record<string, string | undefined>; name: string }) {
  const rest = Object.fromEntries(Object.entries(params).filter(([k, v]) => k !== name && v)) as Record<string, string>;
  const qs = new URLSearchParams(rest).toString();
  return (
    <span className="inline-flex min-w-0 max-w-full items-center gap-1 rounded-full border border-line bg-surface py-1 pl-3 pr-1 text-xs">
      <span className="shrink-0 text-muted">{label}</span>
      <span className="truncate font-medium">{value}</span>
      <Link href={qs ? `?${qs}` : "?"} replace scroll={false} className="shrink-0 rounded-full p-1 text-muted hover:text-ink" aria-label={`${label} 조건 지우기`}>
        <CloseIcon className="size-3" />
      </Link>
    </span>
  );
}
