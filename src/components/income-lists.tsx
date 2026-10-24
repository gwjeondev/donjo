// 손익 화면의 목록들. 매매기록·보유 종목과 같은 모양: 넓은 화면은 표, 좁은 화면은 PositionRow 카드
import Link from "next/link";
import { fmtKrw, fmtPct, fmtPrice, fmtQty, fmtSigned, tone } from "@/lib/format";
import { dividendNetKrw, type Dividend, type RealizedEvent } from "@/lib/income";
import type { TaxableSale } from "@/lib/tax";
import { DeleteDividendButton, EditDividendButton, type DividendStock } from "./dividend-form";
import { PositionRow } from "./position-row";

const stockHref = (symbol: string) => `/stocks/${encodeURIComponent(symbol)}`;
const TABLE = "hidden w-full table-fixed whitespace-nowrap text-sm xl:table [&_td]:overflow-hidden [&_td]:text-ellipsis";
const HEAD = "border-b border-line bg-surface-2 text-xs text-ink-2";
const th = (w: string, align: "left" | "right" | "center" = "right") => `${w} px-3 py-2.5 text-${align} font-medium`;

function StockCell({ name, symbol }: { name: string; symbol: string }) {
  return (
    <td className="px-3 py-3" title={name}>
      <Link href={stockHref(symbol)} className="block truncate font-medium hover:text-brand hover:underline">
        {name}
      </Link>
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
          <li key={e.tradeId}>
            <Link href={stockHref(e.symbol)} className="block px-4 py-3 active:bg-surface-2">
              <PositionRow
                title={e.name}
                info={
                  <>
                    <span className="whitespace-nowrap">{e.date}</span>
                    {showAccount && <> · {accountName.get(e.accountId)}</>} · <span className="whitespace-nowrap">{fmtQty(e.quantity)}주</span>
                  </>
                }
                extra={
                  <span className="text-muted">
                    <span className="whitespace-nowrap">매도 {fmtPrice(e.price, e.currency)}</span> ·{" "}
                    <span className="whitespace-nowrap">평단 {fmtPrice(e.avgCost, e.currency)}</span>
                  </span>
                }
                value={fmtSigned(e.pnlKrw)}
                valueClass={tone(e.pnlKrw)}
                pnl={fmtPct(e.returnRate)}
                rate=""
                toneClass={tone(e.returnRate)}
              />
            </Link>
          </li>
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
          <li key={s.tradeId}>
            <Link href={stockHref(s.symbol)} className="block px-4 py-3 active:bg-surface-2">
              <PositionRow
                title={s.name}
                info={
                  <>
                    <span className="whitespace-nowrap">{s.date}</span>
                    {showAccount && <> · {accountName.get(s.accountId)}</>} · <span className="whitespace-nowrap">{fmtQty(s.quantity)}주</span>
                  </>
                }
                value={fmtSigned(s.gainKrw)}
                valueClass={tone(s.gainKrw)}
                pnl={`양도 ${fmtKrw(s.proceedsKrw)}`}
                rate={`취득 ${fmtKrw(s.costKrw)}`}
                toneClass="text-ink-2"
              />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** 배당금: 지급 한 건마다, 수정·삭제 버튼 포함 (매매기록과 같은 자리) */
export function DividendList({
  dividends,
  accountName,
  showAccount,
  accounts,
  stocks,
}: {
  dividends: Dividend[];
  accountName: Map<string, string>;
  showAccount: boolean;
  accounts: { id: string; name: string }[];
  stocks: DividendStock[];
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
            <th className="w-20 px-2 py-2.5" />
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {dividends.map((d) => (
            <tr key={d.id} className="hover:bg-surface-2/60">
              <td className="py-3 pl-4 pr-3 text-ink-2">{d.payDate}</td>
              {showAccount && <td className="truncate px-3 py-3 text-ink-2">{accountName.get(d.accountId)}</td>}
              <td className="px-3 py-3" title={d.name}>
                <Link href={stockHref(d.symbol)} className="block truncate font-medium hover:text-brand hover:underline">
                  {d.name}
                </Link>
                {d.memo && <div className="truncate text-xs text-muted">{d.memo}</div>}
              </td>
              <td className="px-3 py-3 text-right">{fmtPrice(d.amount, cur(d))}</td>
              <td className="px-3 py-3 text-right text-ink-2">{d.tax ? fmtPrice(d.tax, cur(d)) : "-"}</td>
              <td className="px-3 py-3 text-right font-medium text-up">+{fmtKrw(dividendNetKrw(d))}</td>
              <td className="px-2 py-2">
                <div className="flex justify-end">
                  <EditDividendButton accounts={accounts} stocks={stocks} dividend={d} />
                  <DeleteDividendButton id={d.id} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="divide-y divide-line xl:hidden">
        {dividends.map((d) => (
          <li key={d.id} className="flex items-center gap-2 py-3 pl-4 pr-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <Link href={stockHref(d.symbol)} className="truncate font-medium">
                  {d.name}
                </Link>
                <span className="shrink-0 whitespace-nowrap text-sm font-medium text-up">+{fmtKrw(dividendNetKrw(d))}</span>
              </div>
              <div className="mt-1 text-xs text-muted" data-wrap="ok">
                <span className="whitespace-nowrap">{d.payDate}</span>
                {showAccount && <> · {accountName.get(d.accountId)}</>} ·{" "}
                <span className="whitespace-nowrap">세전 {fmtPrice(d.amount, cur(d))}</span>
                {d.tax ? <span className="whitespace-nowrap"> · 세금 {fmtPrice(d.tax, cur(d))}</span> : null}
                {d.memo ? <> · {d.memo}</> : null}
              </div>
            </div>
            <div className="flex shrink-0 flex-col">
              <EditDividendButton accounts={accounts} stocks={stocks} dividend={d} />
              <DeleteDividendButton id={d.id} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
