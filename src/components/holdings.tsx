"use client";

import Link from "next/link";
import { useState } from "react";
import { fmtPct, fmtPrice, fmtQty, MARKET_LABEL, tone } from "@/lib/format";
import { displayFigures, type ValuedPosition } from "@/lib/portfolio";
import { DEFAULT_PREFS, HOLDING_SORTS, sortBy, type HoldingSortKey, type Sort } from "@/lib/prefs";
import { CurrencyToggle, useDisplayCurrency } from "./currency";
import { PositionRow } from "./position-row";
import { SortControl } from "./sort-control";

/** 오늘 등락률 (전일 종가 대비) */
function DayChange({ p, prefix = "", inline = false }: { p: ValuedPosition; prefix?: string; inline?: boolean }) {
  if (p.price == null || !p.previousClose) return null;
  const r = p.price / p.previousClose - 1;
  const Tag = inline ? "span" : "div";
  return (
    <Tag className={inline ? "" : "text-xs"}>
      {prefix}
      <span className="text-muted">오늘 </span>
      <span className={tone(r)}>{fmtPct(r)}</span>
    </Tag>
  );
}

const HOLDING_VALUE: Record<HoldingSortKey, (p: ValuedPosition) => number | string> = {
  value: (p) => p.valueKrw,
  returnRate: (p) => p.returnRate,
  pnl: (p) => p.unrealizedPnlKrw,
  realized: (p) => p.realizedPnlKrw,
  dayChange: (p) => (p.price != null && p.previousClose ? p.price / p.previousClose - 1 : 0),
  name: (p) => p.name,
};

const stockHref = (symbol: string) => `/stocks/${encodeURIComponent(symbol)}`;
const signed = (n: number, c: "KRW" | "USD") => `${n > 0 ? "+" : n < 0 ? "-" : ""}${fmtPrice(Math.abs(n), c)}`;

export function Holdings({
  title = "보유 종목",
  positions,
  totalValue,
  usdKrw,
  sort: initialSort = DEFAULT_PREFS.holdings,
}: {
  title?: string;
  positions: ValuedPosition[];
  totalValue: number;
  usdKrw: number;
  /** 설정에서 정한 기본 정렬. 여기서 바꾼 정렬은 이 화면에서만 쓴다 */
  sort?: Sort<HoldingSortKey>;
}) {
  const { currency } = useDisplayCurrency();
  const [sort, setSort] = useState(initialSort);
  const held = sortBy(
    positions.filter((p) => p.quantity > 0),
    (p) => HOLDING_VALUE[sort.key](p),
    sort.dir,
  );
  const hasUs = held.some((p) => p.currency === "USD");
  const rows = held.map((p) => ({ p, d: displayFigures(p, currency, usdKrw) }));

  return (
    <section>
      {/* 좁으면 정렬·통화 버튼이 다음 줄로 내려간다 */}
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="shrink-0 font-semibold">{title}</h2>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          {held.length > 1 && <SortControl options={HOLDING_SORTS} value={sort} onChange={setSort} />}
          {hasUs && <CurrencyToggle />}
        </div>
      </div>
      {held.length === 0 ? (
        <p className="card p-8 text-center text-sm text-muted">보유 중인 종목이 없어요. 매수 기록을 추가해 보세요.</p>
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
                    <Link
                      href={stockHref(p.symbol)}
                      className="block truncate font-medium hover:text-brand hover:underline"
                    >
                      {p.name}
                    </Link>
                    <div className="truncate text-xs text-muted">
                      {MARKET_LABEL[p.market]} · {p.symbol.replace(/\.(KS|KQ)$/, "")}
                      <span className="xl:hidden"> · {fmtQty(p.quantity)}주</span>
                    </div>
                  </td>
                  <td className="hidden px-3 py-3 text-right xl:table-cell">{fmtQty(p.quantity)}</td>
                  <td className="px-3 py-3 text-right">
                    <div>
                      {d.price != null ? fmtPrice(d.price, d.currency) : <span className="text-muted">시세 없음</span>}
                    </div>
                    <div className="text-xs text-muted">{fmtPrice(d.avgCost, d.currency)}</div>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <div className="font-medium">{fmtPrice(d.value, d.currency)}</div>
                    <DayChange p={p} />
                  </td>
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
              <li key={`${p.accountId}-${p.symbol}`}>
                <Link href={stockHref(p.symbol)} className="block px-4 py-3 active:bg-surface-2">
                  <PositionRow
                    title={p.name}
                    info={
                      <>
                        <span className="whitespace-nowrap">{fmtQty(p.quantity)}주</span> ·{" "}
                        <span className="whitespace-nowrap">평단 {fmtPrice(d.avgCost, d.currency)}</span>
                      </>
                    }
                    extra={<DayChange p={p} inline />}
                    value={fmtPrice(d.value, d.currency)}
                    pnl={signed(d.pnl, d.currency)}
                    rate={fmtPct(d.returnRate)}
                    toneClass={tone(d.pnl)}
                  />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
