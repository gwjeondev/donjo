import { fmtKrw, fmtPct, fmtSigned, tone } from "@/lib/format";
import type { Summary } from "@/lib/portfolio";

export function SummaryCards({ summary, dividendKrw = 0 }: { summary: Summary; dividendKrw?: number }) {
  // 총손익 = 평가손익 + 실현손익 + 받은 배당금
  const total = summary.totalPnlKrw + dividendKrw;
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]">
      <div className="card p-5">
        <p className="text-sm text-ink-2">총 평가금액</p>
        <p className="mt-1 text-3xl font-bold tracking-tight">{fmtKrw(summary.valueKrw)}</p>
        <p className={`mt-1 text-sm font-medium ${tone(summary.dayChangeKrw)}`}>
          오늘 {fmtSigned(summary.dayChangeKrw)}
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
