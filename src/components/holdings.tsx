import { fmtKrw, fmtPct, fmtPrice, fmtQty, fmtSigned, MARKET_LABEL, tone } from "@/lib/format";
import type { ValuedPosition } from "@/lib/portfolio";

export function Holdings({ positions, totalValue }: { positions: ValuedPosition[]; totalValue: number }) {
  const held = positions.filter((p) => p.quantity > 0).sort((a, b) => b.valueKrw - a.valueKrw);
  if (held.length === 0) {
    return <p className="card p-8 text-center text-sm text-muted">보유 중인 종목이 없습니다. 매수 기록을 추가해 보세요.</p>;
  }
  return (
    <div className="card overflow-hidden">
      {/* PC: 표 */}
      <table className="hidden w-full text-sm md:table">
        <thead className="whitespace-nowrap border-b border-line bg-surface-2 text-xs text-ink-2">
          <tr>
            <th className="px-4 py-2.5 text-left font-medium">종목</th>
            <th className="px-4 py-2.5 text-right font-medium">보유수량</th>
            <th className="px-4 py-2.5 text-right font-medium">평균단가</th>
            <th className="px-4 py-2.5 text-right font-medium">현재가</th>
            <th className="px-4 py-2.5 text-right font-medium">평가금액</th>
            <th className="px-4 py-2.5 text-right font-medium">평가손익</th>
            <th className="px-4 py-2.5 text-right font-medium">비중</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {held.map((p) => (
            <tr key={`${p.accountId}-${p.symbol}`} className="hover:bg-surface-2/60">
              <td className="px-4 py-3">
                <div className="font-medium">{p.name}</div>
                <div className="text-xs text-muted">
                  {MARKET_LABEL[p.market]} · {p.symbol.replace(/\.(KS|KQ)$/, "")}
                </div>
              </td>
              <td className="px-4 py-3 text-right">{fmtQty(p.quantity)}</td>
              <td className="px-4 py-3 text-right">{fmtPrice(p.avgCost, p.currency)}</td>
              <td className="px-4 py-3 text-right">
                {p.price != null ? fmtPrice(p.price, p.currency) : <span className="text-muted">시세 없음</span>}
              </td>
              <td className="px-4 py-3 text-right font-medium">{fmtKrw(p.valueKrw)}</td>
              <td className={`px-4 py-3 text-right ${tone(p.unrealizedPnlKrw)}`}>
                <div>{fmtSigned(p.unrealizedPnlKrw)}</div>
                <div className="text-xs">{fmtPct(p.returnRate)}</div>
              </td>
              <td className="px-4 py-3 text-right text-ink-2">
                {totalValue > 0 ? fmtPct(p.valueKrw / totalValue, false) : "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* 모바일: 카드 목록 */}
      <ul className="divide-y divide-line md:hidden">
        {held.map((p) => (
          <li key={`${p.accountId}-${p.symbol}`} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <div className="truncate font-medium">{p.name}</div>
              <div className="text-xs text-muted">
                {fmtQty(p.quantity)}주 · 평단 {fmtPrice(p.avgCost, p.currency)}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div className="font-medium">{fmtKrw(p.valueKrw)}</div>
              <div className={`text-xs ${tone(p.unrealizedPnlKrw)}`}>
                {fmtSigned(p.unrealizedPnlKrw)} ({fmtPct(p.returnRate)})
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
