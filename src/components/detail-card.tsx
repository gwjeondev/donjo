import Link from "next/link";
import { ChevronRightIcon } from "./icons";

/** [이름표, 값, 값 색(선택)] */
export type DetailRow = [label: string, value: React.ReactNode, className?: string];

/**
 * 휴대폰 목록의 한 칸 (수익률 화면 기간별 목록과 같은 모양).
 *   제목 (+보조 설명)            큰 값
 *   이름표 ............................ 값
 *   이름표 ............................ 값
 * 한 줄에 몰아넣지 않고 항목마다 줄을 나눠 숫자가 잘리지 않게 한다. 긴 이름은 한 줄에서 …으로 줄인다.
 */
export function DetailCard({
  title,
  badge,
  sub,
  href,
  value,
  valueClass = "",
  rows,
  actions,
  to,
}: {
  /** 이름. 길면 한 줄에서 …으로 줄인다 (전체 이름은 title 툴팁) */
  title: string;
  /** 이름 앞의 작은 표시 (매수/매도 등) */
  badge?: React.ReactNode;
  sub?: React.ReactNode;
  /** 누르면 갈 곳 (종목 화면 등). 수정·삭제 버튼이 없으면 카드 전체가 눌리고, 있으면 이름만 눌린다 */
  href?: string;
  value: React.ReactNode;
  valueClass?: string;
  rows: DetailRow[];
  /** 수정·삭제 등 (아래 오른쪽) */
  actions?: React.ReactNode;
  /** 카드 전체를 누르면 갈 곳 (href 대신) */
  to?: string;
}) {
  // 버튼이 없는 카드는 카드 전체를 링크로 (오른쪽 › 표시)
  const whole = to ?? (actions ? undefined : href);
  const titleHref = whole ? undefined : href;
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        {/* 왼쪽(이름)은 남는 폭만 쓰고 넘치면 …, 오른쪽(값)은 줄어들지 않는다 → 서로 겹치지 않음 */}
        <div className="min-w-0 flex-1" data-slot="left">
          <div className="flex min-w-0 items-center gap-1.5">
            {badge}
            {titleHref ? (
              <Link href={titleHref} title={title} className="min-w-0 truncate text-sm font-medium hover:text-brand hover:underline">
                {title}
              </Link>
            ) : (
              <span title={title} className="min-w-0 truncate text-sm font-medium">
                {title}
              </span>
            )}
          </div>
          {sub && <div className="mt-0.5 truncate text-xs text-muted" title={typeof sub === "string" ? sub : undefined}>{sub}</div>}
        </div>
        <span className={`flex shrink-0 items-center gap-0.5 whitespace-nowrap text-base font-semibold ${valueClass}`} data-slot="right">
          {value}
          {whole && <ChevronRightIcon className="-mr-1 size-4 text-muted" />}
        </span>
      </div>
      {rows.length > 0 && (
      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        {rows.map(([label, v, cls = ""]) => (
          <div key={label} className="contents">
            <dt className="whitespace-nowrap text-muted">{label}</dt>
            <dd className={`min-w-0 truncate text-right ${cls}`} title={typeof v === "string" ? v : undefined}>
              {v}
            </dd>
          </div>
        ))}
      </dl>
      )}
      {actions && <div className="-mb-1 -mr-1.5 mt-1 flex justify-end">{actions}</div>}
    </>
  );
  return whole ? (
    <li>
      <Link href={whole} className="block px-4 py-3 hover:bg-surface-2/60 active:bg-surface-2">
        {body}
      </Link>
    </li>
  ) : (
    <li className="px-4 py-3">{body}</li>
  );
}

/** 표 안에서 다른 화면으로 가는 이름: 이름 뒤에 › 를 붙여 눌러서 이동할 수 있다는 걸 보여 준다 */
export function NameLink({ href, children, title, className = "" }: { href: string; children: React.ReactNode; title?: string; className?: string }) {
  return (
    <Link href={href} title={title} className={`group flex min-w-0 items-center gap-0.5 font-medium hover:text-brand ${className}`}>
      <span className="min-w-0 truncate group-hover:underline">{children}</span>
      <ChevronRightIcon className="size-3.5 shrink-0 text-muted group-hover:text-brand" />
    </Link>
  );
}
