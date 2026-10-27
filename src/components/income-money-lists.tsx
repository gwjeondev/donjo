"use client";

import { fmtPct, fmtPrice, fmtQty, fmtSignedPrice, tone } from "@/lib/format";
import { dividendNetKrw, type Dividend, type RealizedEvent } from "@/lib/income";
import { useDisplayCurrency } from "./currency";
import { DetailCard, type DetailRow } from "./detail-card";
import { HEAD, StockCell, TABLE, th } from "./income-lists";

/** 해외 종목 한 건을 고른 통화로: 원화는 매도가 = 매도일 환율, 평단가·손익 = 기록한 매수·매도 환율로 환산한 값 */
function view(e: RealizedEvent, currency: "KRW" | "USD") {
  if (e.currency === "USD" && currency === "USD")
    return { cur: "USD" as const, price: e.price, avgCost: e.avgCost, pnl: e.pnl, rate: e.cost > 0 ? e.pnl / e.cost : 0 };
  return { cur: "KRW" as const, price: e.price * e.fxRate, avgCost: e.avgCostKrw, pnl: e.pnlKrw, rate: e.returnRate };
}

/** 실현손익: 매도 한 건마다. 해외 종목은 원화/달러 전환을 따른다 */
export function RealizedList({ events, accountName, showAccount }: { events: RealizedEvent[]; accountName: Record<string, string>; showAccount: boolean }) {
  const { currency } = useDisplayCurrency();
  const rows = events.map((e) => ({ e, v: view(e, currency) }));
  return (
    <div className="card overflow-hidden">
      <table className={TABLE}>
        <thead className={HEAD}>
          <tr>
            <th className={`${th("w-32", "left")} pl-4`}>매도일</th>
            {showAccount && <th className={th("w-28", "left")}>계좌</th>}
            <th className={th("", "left")}>종목</th>
            <th className={th("w-28")}>수량</th>
            <th className={th("w-32")}>매도가</th>
            <th className={th("w-32")}>평단가</th>
            <th className={th("w-36")}>실현손익</th>
            <th className={`${th("w-24")} pr-4`}>수익률</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map(({ e, v }) => (
            <tr key={e.tradeId} className="hover:bg-surface-2/60">
              <td className="py-3 pl-4 pr-3 text-ink-2">{e.date}</td>
              {showAccount && <td className="truncate px-3 py-3 text-ink-2">{accountName[e.accountId]}</td>}
              <StockCell name={e.name} />
              <td className="px-3 py-3 text-right">{fmtQty(e.quantity)}</td>
              <td className="px-3 py-3 text-right">{fmtPrice(v.price, v.cur)}</td>
              <td className="px-3 py-3 text-right text-ink-2">{fmtPrice(v.avgCost, v.cur)}</td>
              <td className={`px-3 py-3 text-right font-medium ${tone(v.pnl)}`}>{fmtSignedPrice(v.pnl, v.cur)}</td>
              <td className={`py-3 pl-3 pr-4 text-right ${tone(v.rate)}`}>{fmtPct(v.rate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="divide-y divide-line xl:hidden">
        {rows.map(({ e, v }) => (
          <DetailCard
            key={e.tradeId}
            title={e.name}
            sub={`${e.date}${showAccount ? ` · ${accountName[e.accountId]}` : ""}`}
            value={fmtSignedPrice(v.pnl, v.cur)}
            valueClass={tone(v.pnl)}
            rows={[
              ["수익률", fmtPct(v.rate), tone(v.rate)],
              ["수량", `${fmtQty(e.quantity)}주`],
              ["매도가", fmtPrice(v.price, v.cur)],
              ["평단가", fmtPrice(v.avgCost, v.cur)],
            ]}
          />
        ))}
      </ul>
    </div>
  );
}

/** 배당금: 받은 건마다. 해외 종목은 원화/달러 전환을 따른다 (원화는 지급일 환율로 환산) */
export function DividendList({ dividends, accountName, showAccount }: { dividends: Dividend[]; accountName: Record<string, string>; showAccount: boolean }) {
  const { currency } = useDisplayCurrency();
  const rows = dividends.map((d) => {
    const usd = d.market === "US" && currency === "USD";
    const fx = d.market === "US" && !usd ? d.fxRate : 1;
    const cur = usd ? ("USD" as const) : ("KRW" as const);
    return { d, cur, amount: d.amount * fx, tax: d.tax * fx, net: usd ? d.amount - d.tax : dividendNetKrw(d) };
  });
  return (
    <div className="card overflow-hidden">
      <table className={TABLE}>
        <thead className={HEAD}>
          <tr>
            <th className={`${th("w-32", "left")} pl-4`}>지급일</th>
            {showAccount && <th className={th("w-28", "left")}>계좌</th>}
            <th className={th("", "left")}>종목</th>
            <th className={th("w-32")}>세전</th>
            <th className={th("w-28")}>세금</th>
            <th className={`${th("w-36")} pr-4`}>받은 금액</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map(({ d, cur, amount, tax, net }) => (
            <tr key={d.id} className="hover:bg-surface-2/60">
              <td className="py-3 pl-4 pr-3 text-ink-2">{d.payDate}</td>
              {showAccount && <td className="truncate px-3 py-3 text-ink-2">{accountName[d.accountId]}</td>}
              <td className="px-3 py-3" title={d.name}>
                <span className="block truncate">{d.name}</span>
                {d.memo && <div className="truncate text-xs text-muted">{d.memo}</div>}
              </td>
              <td className="px-3 py-3 text-right">{fmtPrice(amount, cur)}</td>
              <td className="px-3 py-3 text-right text-ink-2">{tax ? fmtPrice(tax, cur) : "-"}</td>
              <td className="py-3 pl-3 pr-4 text-right font-medium text-up">{fmtSignedPrice(net, cur)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="divide-y divide-line xl:hidden">
        {rows.map(({ d, cur, amount, tax, net }) => {
          const r: DetailRow[] = [
            ["세전", fmtPrice(amount, cur)],
            ["세금", tax ? fmtPrice(tax, cur) : "-"],
          ];
          if (d.market === "US") r.push(["환율", `${fmtQty(d.fxRate)}원`]);
          if (d.memo) r.push(["메모", d.memo]);
          return (
            <DetailCard
              key={d.id}
              title={d.name}
              sub={`${d.payDate}${showAccount ? ` · ${accountName[d.accountId]}` : ""}`}
              value={fmtSignedPrice(net, cur)}
              valueClass="text-up"
              rows={r}
            />
          );
        })}
      </ul>
    </div>
  );
}
