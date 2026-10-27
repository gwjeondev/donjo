import { fmtKrw, fmtPct, fmtSigned, tone } from "@/lib/format";
import { cashKrw, type CashBalance } from "@/lib/cash";
import type { Summary } from "@/lib/portfolio";

export function SummaryCards({
  summary,
  dividendKrw = 0,
  cash,
  usdKrw = 0,
}: {
  summary: Summary;
  dividendKrw?: number;
  /** 현금 잔고. 있으면 첫 카드가 총자산(주식 + 현금)이 된다 */
  cash?: CashBalance;
  usdKrw?: number;
}) {
  // 현금 잔고를 넘겨받는 화면(대시보드·계좌 상세)은 현금이 0이어도 총자산 = 주식 + 현금으로 나눠 보여 준다
  const showCash = !!cash;
  const cashTotal = cash ? cashKrw(cash, usdKrw) : 0;
  // 총손익 = 평가손익 + 실현손익 + 받은 배당금
  const total = summary.totalPnlKrw + dividendKrw;
  // 오늘 등락률: 어제 종가 기준 주식 평가금액 대비 (현금은 하루 등락이 없어 빼고 본다)
  const dayBase = summary.valueKrw - summary.dayChangeKrw;
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]">
      <div className="card p-5">
        <p className="text-sm text-ink-2">{showCash ? "총자산" : "총 평가금액"}</p>
        <p className="mt-1 text-3xl font-bold tracking-tight">{fmtKrw(summary.valueKrw + cashTotal)}</p>
        {cash && (
          // 주식·현금 내역을 한 줄로: 현금은 원화(₩)와 달러($)를 따로 (총자산에는 달러를 오늘 환율로 원화 환산해 더한다)
          <p className="mt-1 flex flex-wrap gap-x-1.5 text-xs text-muted">
            <span className="whitespace-nowrap">주식 {fmtKrw(summary.valueKrw)}</span>
            <span aria-hidden>·</span>
            <span className="whitespace-nowrap">
              현금 <span className={cash.krw < 0 ? "text-up" : ""}>{Math.round(cash.krw).toLocaleString("ko-KR")}₩</span>
              {Math.abs(cash.usd) >= 0.01 && (
                <span className={`ml-1.5 ${cash.usd < 0 ? "text-up" : ""}`}>
                  {cash.usd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}$
                </span>
              )}
            </span>
          </p>
        )}
        {/* 좁으면 금액과 퍼센트 사이에서만 줄이 바뀐다 */}
        <p className={`mt-2 flex flex-wrap gap-x-1 text-sm font-medium ${tone(summary.dayChangeKrw)}`} data-wrap="ok">
          <span className="whitespace-nowrap">오늘 {fmtSigned(summary.dayChangeKrw)}</span>
          {dayBase > 0 && <span className="whitespace-nowrap">({fmtPct(summary.dayChangeKrw / dayBase)})</span>}
        </p>
      </div>
      <div className="card p-5">
        <p className="text-sm text-ink-2">평가손익</p>
        <p className={`mt-1 text-2xl font-bold ${tone(summary.unrealizedPnlKrw)}`}>
          {fmtSigned(summary.unrealizedPnlKrw)}
        </p>
        <p className={`mt-1 text-sm font-medium ${tone(summary.returnRate)}`}>{fmtPct(summary.returnRate)}</p>
        <p className="mt-2 text-xs text-muted">매입금액 {fmtKrw(summary.costBasisKrw)}</p>
      </div>
      <div className="card p-5">
        <p className="text-sm text-ink-2">실현손익</p>
        <p className={`mt-1 text-2xl font-bold ${tone(summary.realizedPnlKrw)}`}>{fmtSigned(summary.realizedPnlKrw)}</p>
        <p className="mt-2 text-xs text-muted">
          {dividendKrw > 0 && (
            <>
              배당 <span className={tone(dividendKrw)}>{fmtSigned(dividendKrw)}</span> ·{" "}
            </>
          )}
          총손익 <span className={tone(total)}>{fmtSigned(total)}</span>
        </p>
      </div>
    </div>
  );
}
