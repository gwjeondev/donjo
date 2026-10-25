import { InfoTip } from "./info-tip";
import { AccountFilter } from "./account-filter";

/** 수익률·손익 화면 공통: 계좌 선택 + 조회 기간을 한 줄(좁으면 두 줄)로 */
export function FilterRow({
  accounts,
  account,
  extra,
  children,
}: {
  accounts: { id: string; name: string }[];
  account?: string;
  /** 계좌 옆에 붙는 필터 (예: 국내/해외) */
  extra?: React.ReactNode;
  /** 조회 기간 버튼 */
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <AccountFilter accounts={accounts} value={account} />
        {extra}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** 요약 카드 한 칸 */
export function StatCard({
  label,
  value,
  valueClass = "",
  sub,
  info,
}: {
  label: string;
  value: string;
  valueClass?: string;
  sub?: React.ReactNode;
  /** 이 숫자가 어떻게 계산됐는지: 제목 옆 ⓘ로 연다 */
  info?: React.ReactNode;
}) {
  return (
    <div className="card p-5">
      <p className="flex items-center gap-0.5 text-sm text-ink-2">
        {label}
        {info && <InfoTip title={label}>{info}</InfoTip>}
      </p>
      <p className={`mt-1 text-2xl font-bold ${valueClass}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
    </div>
  );
}
