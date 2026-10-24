/**
 * 모바일 보유 종목 한 줄 (3행 그리드). 오른쪽 숫자 칸을 두 줄로 나눠 왼쪽 정보가 잘리지 않게 한다.
 *   종목명           평가금액
 *   수량 · 평단       손익 금액
 *   (보조 정보)       수익률
 * 왼쪽 정보는 잘라내지 않고, 정말 좁으면 단어 단위로 줄바꿈한다.
 */
export function PositionRow({
  title,
  info,
  extra,
  value,
  pnl,
  rate,
  toneClass,
  valueClass = "",
}: {
  title: React.ReactNode;
  info: React.ReactNode;
  extra?: React.ReactNode;
  value: string;
  pnl: string;
  rate: string;
  toneClass: string;
  /** 오른쪽 첫 줄(금액) 색 — 손익이 주인공인 목록에서 */
  valueClass?: string;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 gap-y-0.5">
      <div className="truncate font-medium">{title}</div>
      <div className={`whitespace-nowrap text-right font-medium ${valueClass}`}>{value}</div>
      <div className="text-xs text-muted" data-wrap="ok">
        {info}
      </div>
      <div className={`whitespace-nowrap text-right text-xs ${toneClass}`}>{pnl}</div>
      <div className="text-xs">{extra}</div>
      <div className={`whitespace-nowrap text-right text-xs ${toneClass}`}>{rate}</div>
    </div>
  );
}
