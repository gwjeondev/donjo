import Link from "next/link";

/** [이름표, 값, 값 색(선택)] */
export type DetailRow = [label: string, value: React.ReactNode, className?: string];

/**
 * 휴대폰 목록의 한 칸 (수익률 화면 기간별 목록과 같은 모양).
 *   제목 (+보조 설명)            큰 값
 *   이름표 ............................ 값
 *   이름표 ............................ 값
 * 한 줄에 몰아넣지 않고 항목마다 줄을 나눠 숫자가 잘리지 않게 한다. 긴 이름은 자르지 않고 줄바꿈한다.
 */
export function DetailCard({
  title,
  sub,
  href,
  value,
  valueClass = "",
  rows,
  actions,
}: {
  title: React.ReactNode;
  sub?: React.ReactNode;
  /** 제목을 누르면 갈 곳 (종목 화면 등) */
  href?: string;
  value: React.ReactNode;
  valueClass?: string;
  rows: DetailRow[];
  /** 수정·삭제 등 (아래 오른쪽) */
  actions?: React.ReactNode;
}) {
  return (
    <li className="px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {href ? (
            <Link href={href} className="block break-words text-sm font-medium [word-break:keep-all] hover:text-brand hover:underline" data-wrap="ok">
              {title}
            </Link>
          ) : (
            <div className="break-words text-sm font-medium [word-break:keep-all]" data-wrap="ok">{title}</div>
          )}
          {sub && <div className="mt-0.5 truncate text-xs text-muted">{sub}</div>}
        </div>
        <span className={`shrink-0 whitespace-nowrap text-base font-semibold ${valueClass}`}>{value}</span>
      </div>
      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        {rows.map(([label, v, cls = ""]) => (
          <div key={label} className="contents">
            <dt className="text-muted">{label}</dt>
            <dd className={`text-right ${cls}`}>{v}</dd>
          </div>
        ))}
      </dl>
      {actions && <div className="-mb-1 -mr-1.5 mt-1 flex justify-end">{actions}</div>}
    </li>
  );
}
