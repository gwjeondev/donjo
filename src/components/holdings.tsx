"use client";

import { fmtPct, fmtPrice, fmtQty, MARKET_LABEL, tone } from "@/lib/format";
import { displayFigures, type ValuedPosition } from "@/lib/portfolio";
import { CurrencyToggle, useDisplayCurrency } from "./currency";

const signed = (n: number, c: "KRW" | "USD") => `${n > 0 ? "+" : n < 0 ? "-" : ""}${fmtPrice(Math.abs(n), c)}`;

export function Holdings({
  title = "보유 종목",
  positions,
  totalValue,
  usdKrw,
}: {
  title?: string;
  positions: ValuedPosition[];
  totalValue: number;
  usdKrw: number;
}) {
  const { currency } = useDisplayCurrency();
  const held = positions.filter((p) => p.quantity > 0).sort((a, b) => b.valueKrw - a.valueKrw);
  const hasUs = held.some((p) => p.currency === "USD");
  const rows = held.map((p) => ({ p, d: displayFigures(p, currency, usdKrw) }));

  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="font-semibold">{title}</h2>
        {hasUs && <CurrencyToggle />}
      </div>
      {held.length === 0 ? (
        <p className="card p-8 text-center text-sm text-muted">보유 중인 종목이 없습니다. 매수 기록을 추가해 보세요.</p>
      ) : (
        <div className="card overflow-hidden">
          {/* PC(lg 이상): 표. 숫자 칸은 폭을 고정해 원화/달러 전환 시 칸이 움직이지 않게 하고, 종목명이 남는 폭을 쓰며 넘치면 말줄임 */}
          <table className="hidden w-full table-fixed whitespace-nowrap text-sm lg:table [&_td]:overflow-hidden [&_td]:text-ellipsis">
            <thead className="border-b border-line bg-surface-2 text-xs text-ink-2">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">종목</th>
                <th className="hidden w-32 px-3 py-2.5 text-right font-medium xl:table-cell">보유수량</th>
                <th className="w-36 px-3 py-2.5 text-right font-medium">현재가 / 평단</th>
                <th className="w-40 px-3 py-2.5 text-right font-medium">평가금액</th>
                <th className="w-40 px-3 py-2.5 text-right font-medium">평가손익</th>
                <th className="hidden w-24 px-4 py-2.5 text-right font-medium xl:table-cell">비중</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map(({ p, d }) => (
                <tr key={`${p.accountId}-${p.symbol}`} className="hover:bg-surface-2/60">
                  <td className="px-4 py-3" title={p.name}>
                    <div className="truncate font-medium">{p.name}</div>
                    <div className="truncate text-xs text-muted">
                      {MARKET_LABEL[p.market]} · {p.symbol.replace(/\.(KS|KQ)$/, "")}
                      <span className="xl:hidden"> · {fmtQty(p.quantity)}주</span>
                    </div>
                  </td>
                  <td className="hidden px-3 py-3 text-right xl:table-cell">{fmtQty(p.quantity)}</td>
                  <td className="px-3 py-3 text-right">
                    <div>{d.price != null ? fmtPrice(d.price, d.currency) : <span className="text-muted">시세 없음</span>}</div>
                    <div className="text-xs text-muted">{fmtPrice(d.avgCost, d.currency)}</div>
                  </td>
                  <td className="px-3 py-3 text-right font-medium">{fmtPrice(d.value, d.currency)}</td>
                  <td className={`px-3 py-3 text-right ${tone(d.pnl)}`}>
                    <div>{signed(d.pnl, d.currency)}</div>
                    <div className="text-xs">{fmtPct(d.returnRate)}</div>
                  </td>
                  <td className="hidden px-4 py-3 text-right text-ink-2 xl:table-cell">
                    {totalValue > 0 ? fmtPct(p.valueKrw / totalValue, false) : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* 모바일·태블릿: 카드 목록 */}
          <ul className="divide-y divide-line lg:hidden">
            {rows.map(({ p, d }) => (
              <li key={`${p.accountId}-${p.symbol}`} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="truncate font-medium">{p.name}</div>
                  <div className="truncate text-xs text-muted">
                    {fmtQty(p.quantity)}주 · 평단 {fmtPrice(d.avgCost, d.currency)}
                  </div>
                </div>
                <div className="shrink-0 whitespace-nowrap text-right">
                  <div className="font-medium">{fmtPrice(d.value, d.currency)}</div>
                  <div className={`text-xs ${tone(d.pnl)}`}>
                    {signed(d.pnl, d.currency)} ({fmtPct(d.returnRate)})
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
