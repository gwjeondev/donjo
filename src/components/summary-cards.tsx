import { fmtKrw, fmtPct, fmtSigned, tone } from "@/lib/format";
import { cashKrw, hasCash, type CashBalance } from "@/lib/cash";
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
  const showCash = !!cash && hasCash(cash);
  const cashTotal = cash ? cashKrw(cash, usdKrw) : 0;
  // 총손익 = 평가손익 + 실현손익 + 받은 배당금
  const total = summary.totalPnlKrw + dividendKrw;
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]">
      <div className="card p-5">
        <p className="text-sm text-ink-2">{showCash ? "총자산" : "총 평가금액"}</p>
        <p className="mt-1 text-3xl font-bold tracking-tight">{fmtKrw(summary.valueKrw + (showCash ? cashTotal : 0))}</p>
        <p className={`mt-1 text-sm font-medium ${tone(summary.dayChangeKrw)}`}>
          오늘 {fmtSigned(summary.dayChangeKrw)}
        </p>
        {showCash && cash && (
          // 좁은 칸에서 잘리지 않도록 주식·현금을 줄을 나눠 보여 준다
          <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 text-xs text-muted">
            <dt>주식</dt>
            <dd className="text-right">{fmtKrw(summary.valueKrw)}</dd>
            <dt>현금</dt>
            <dd className={`text-right ${cashTotal < 0 ? "text-up" : ""}`}>
              {fmtKrw(cashTotal)}
              {Math.abs(cash.usd) >= 0.01 && <span className="block">달러 ${cash.usd.toLocaleString("en-US", { maximumFractionDigits: 2 })}</span>}
            </dd>
          </dl>
        )}
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
