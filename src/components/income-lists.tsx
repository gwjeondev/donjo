// 손익 화면의 목록들. 다른 목록과 같은 모양: 넓은 화면은 표, 좁은 화면은 DetailCard
import { fmtKrw, fmtPct, fmtPrice, fmtQty, fmtSigned, tone } from "@/lib/format";
import { dividendNetKrw, type Dividend, type RealizedEvent } from "@/lib/income";
import type { TaxableSale } from "@/lib/tax";
import { DetailCard, NameLink, type DetailRow } from "./detail-card";

const stockHref = (symbol: string) => `/stocks/${encodeURIComponent(symbol)}`;
const TABLE = "hidden w-full table-fixed whitespace-nowrap text-sm xl:table [&_td]:overflow-hidden [&_td]:text-ellipsis";
const HEAD = "border-b border-line bg-surface-2 text-xs text-ink-2";
const th = (w: string, align: "left" | "right" | "center" = "right") => `${w} px-3 py-2.5 text-${align} font-medium`;

function StockCell({ name, symbol }: { name: string; symbol: string }) {
  return (
    <td className="px-3 py-3" title={name}>
      <NameLink href={stockHref(symbol)}>{name}</NameLink>
    </td>
  );
}

/** 실현손익: 매도 한 건마다 */
export function RealizedList({ events, accountName, showAccount }: { events: RealizedEvent[]; accountName: Map<string, string>; showAccount: boolean }) {
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
          {events.map((e) => (
            <tr key={e.tradeId} className="hover:bg-surface-2/60">
              <td className="py-3 pl-4 pr-3 text-ink-2">{e.date}</td>
              {showAccount && <td className="truncate px-3 py-3 text-ink-2">{accountName.get(e.accountId)}</td>}
              <StockCell name={e.name} symbol={e.symbol} />
              <td className="px-3 py-3 text-right">{fmtQty(e.quantity)}</td>
              <td className="px-3 py-3 text-right">{fmtPrice(e.price, e.currency)}</td>
              <td className="px-3 py-3 text-right text-ink-2">{fmtPrice(e.avgCost, e.currency)}</td>
              <td className={`px-3 py-3 text-right font-medium ${tone(e.pnlKrw)}`}>{fmtSigned(e.pnlKrw)}</td>
              <td className={`py-3 pl-3 pr-4 text-right ${tone(e.returnRate)}`}>{fmtPct(e.returnRate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="divide-y divide-line xl:hidden">
        {events.map((e) => (
          <DetailCard
            key={e.tradeId}
            title={e.name}
            sub={`${e.date}${showAccount ? ` · ${accountName.get(e.accountId)}` : ""}`}
            href={stockHref(e.symbol)}
            value={fmtSigned(e.pnlKrw)}
            valueClass={tone(e.pnlKrw)}
            rows={[
              ["수익률", fmtPct(e.returnRate), tone(e.returnRate)],
              ["수량", `${fmtQty(e.quantity)}주`],
              ["매도가", fmtPrice(e.price, e.currency)],
              ["평단가", fmtPrice(e.avgCost, e.currency)],
            ]}
          />
        ))}
      </ul>
    </div>
  );
}

/** 양도세: 해외주식 매도 한 건마다 양도가액·취득가액·양도차익 */
export function TaxSaleList({ sales, accountName, showAccount }: { sales: TaxableSale[]; accountName: Map<string, string>; showAccount: boolean }) {
  return (
    <div className="card overflow-hidden">
      <table className={TABLE}>
        <thead className={HEAD}>
          <tr>
            <th className={`${th("w-32", "left")} pl-4`}>매도일</th>
            {showAccount && <th className={th("w-28", "left")}>계좌</th>}
            <th className={th("", "left")}>종목</th>
            <th className={th("w-28")}>수량</th>
            <th className={th("w-36")}>양도가액</th>
            <th className={th("w-36")}>취득가액</th>
            <th className={`${th("w-36")} pr-4`}>양도차익</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {sales.map((s) => (
            <tr key={s.tradeId} className="hover:bg-surface-2/60">
              <td className="py-3 pl-4 pr-3 text-ink-2">{s.date}</td>
              {showAccount && <td className="truncate px-3 py-3 text-ink-2">{accountName.get(s.accountId)}</td>}
              <StockCell name={s.name} symbol={s.symbol} />
              <td className="px-3 py-3 text-right">{fmtQty(s.quantity)}</td>
              <td className="px-3 py-3 text-right">{fmtKrw(s.proceedsKrw)}</td>
              <td className="px-3 py-3 text-right text-ink-2">{fmtKrw(s.costKrw)}</td>
              <td className={`py-3 pl-3 pr-4 text-right font-medium ${tone(s.gainKrw)}`}>{fmtSigned(s.gainKrw)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="divide-y divide-line xl:hidden">
        {sales.map((s) => (
          <DetailCard
            key={s.tradeId}
            title={s.name}
            sub={`${s.date}${showAccount ? ` · ${accountName.get(s.accountId)}` : ""}`}
            href={stockHref(s.symbol)}
            value={fmtSigned(s.gainKrw)}
            valueClass={tone(s.gainKrw)}
            rows={[
              ["수량", `${fmtQty(s.quantity)}주`],
              ["양도가액", fmtKrw(s.proceedsKrw)],
              ["취득가액", fmtKrw(s.costKrw)],
            ]}
          />
        ))}
      </ul>
    </div>
  );
}

/** 배당금: 지급 한 건마다 (조회 전용 — 수정·삭제는 거래내역에서) */
export function DividendList({
  dividends,
  accountName,
  showAccount,
}: {
  dividends: Dividend[];
  accountName: Map<string, string>;
  showAccount: boolean;
}) {
  const cur = (d: Dividend) => (d.market === "US" ? "USD" : "KRW");
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
            <th className={th("w-36")}>받은 금액</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {dividends.map((d) => (
            <tr key={d.id} className="hover:bg-surface-2/60">
              <td className="py-3 pl-4 pr-3 text-ink-2">{d.payDate}</td>
              {showAccount && <td className="truncate px-3 py-3 text-ink-2">{accountName.get(d.accountId)}</td>}
              <td className="px-3 py-3" title={d.name}>
                <NameLink href={stockHref(d.symbol)}>{d.name}</NameLink>
                {d.memo && <div className="truncate text-xs text-muted">{d.memo}</div>}
              </td>
              <td className="px-3 py-3 text-right">{fmtPrice(d.amount, cur(d))}</td>
              <td className="px-3 py-3 text-right text-ink-2">{d.tax ? fmtPrice(d.tax, cur(d)) : "-"}</td>
              <td className="px-3 py-3 text-right font-medium text-up">+{fmtKrw(dividendNetKrw(d))}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="divide-y divide-line xl:hidden">
        {dividends.map((d) => {
          const rows: DetailRow[] = [
            ["세전", fmtPrice(d.amount, cur(d))],
            ["세금", d.tax ? fmtPrice(d.tax, cur(d)) : "-"],
          ];
          if (d.market === "US") rows.push(["환율", `${fmtQty(d.fxRate)}원`]);
          if (d.memo) rows.push(["메모", d.memo]);
          return (
            <DetailCard
              key={d.id}
              title={d.name}
              sub={`${d.payDate}${showAccount ? ` · ${accountName.get(d.accountId)}` : ""}`}
              href={stockHref(d.symbol)}
              value={`+${fmtKrw(dividendNetKrw(d))}`}
              valueClass="text-up"
              rows={rows}
            />
          );
        })}
      </ul>
    </div>
  );
}
