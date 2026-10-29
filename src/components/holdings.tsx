"use client";

import { useState } from "react";
import { fmtFx, fmtPct, fmtPrice, fmtQty, fmtSignedWithPct, MARKET_LABEL, tone } from "@/lib/format";
import { avgBuyFxRate, displayFigures, unrealizedFxKrw, unrealizedFxRate, type ValuedPosition } from "@/lib/portfolio";
import { DEFAULT_PREFS, HOLDING_SORTS, sortBy, type HoldingSortKey, type Sort } from "@/lib/prefs";
import { CurrencyToggle, useDisplayCurrency } from "./currency";
import { DetailCard, NameLink } from "./detail-card";
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

/** 환차손익 칸 (해외 종목만, 항상 원화). 아래 줄은 평균 매수환율 */
function FxCell({ p, usdKrw }: { p: ValuedPosition; usdKrw: number }) {
  const rate = avgBuyFxRate(p);
  if (rate == null) return <td className="px-3 py-3 text-right text-muted">-</td>;
  const fx = unrealizedFxKrw(p, usdKrw);
  return (
    <td className="px-3 py-3 text-right">
      <div className={tone(fx)}>{fmtSignedWithPct(fx, unrealizedFxRate(p, usdKrw))}</div>
      <div className="text-xs text-muted">매수 {fmtFx(rate)}</div>
    </td>
  );
}

/** 카드용 환차손익·평균 매수환율 줄 (해외 종목만) */
const fxRows = (p: ValuedPosition, usdKrw: number): [string, string, string?][] => {
  const rate = avgBuyFxRate(p);
  if (rate == null) return [];
  const fx = unrealizedFxKrw(p, usdKrw);
  return [
    ["환차손익", fmtSignedWithPct(fx, unrealizedFxRate(p, usdKrw)), tone(fx)],
    ["평균 매수환율", fmtFx(rate)],
  ];
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
                {hasUs && <th className="w-48 px-3 py-2.5 text-right font-medium">환차손익</th>}
                <th className="hidden w-24 px-4 py-2.5 text-right font-medium xl:table-cell">비중</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map(({ p, d }) => (
                <tr key={`${p.accountId}-${p.symbol}`} className="hover:bg-surface-2/60">
                  <td className="px-4 py-3" title={p.name}>
                    <NameLink href={stockHref(p.symbol)}>{p.name}</NameLink>
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
                  {hasUs && <FxCell p={p} usdKrw={usdKrw} />}
                  <td className="hidden px-4 py-3 text-right text-ink-2 xl:table-cell">
                    {totalValue > 0 ? fmtPct(p.valueKrw / totalValue, false) : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* 모바일·태블릿: 카드 목록 */}
          <ul className="divide-y divide-line lg:hidden">
            {rows.map(({ p, d }) => {
              const day = p.price != null && p.previousClose ? p.price / p.previousClose - 1 : null;
              return (
                <DetailCard
                  key={`${p.accountId}-${p.symbol}`}
                  title={p.name}
                  sub={`${MARKET_LABEL[p.market]} · ${p.symbol.replace(/\.(KS|KQ)$/, "")}`}
                  href={stockHref(p.symbol)}
                  value={fmtPrice(d.value, d.currency)}
                  rows={[
                    ["평가손익", signed(d.pnl, d.currency), tone(d.pnl)],
                    ["수익률", fmtPct(d.returnRate), tone(d.returnRate)],
                    ["보유수량", `${fmtQty(p.quantity)}주`],
                    ["현재가", d.price != null ? fmtPrice(d.price, d.currency) : "시세 없음"],
                    ["평단가", fmtPrice(d.avgCost, d.currency)],
                    ...fxRows(p, usdKrw),
                    ["오늘", day == null ? "-" : fmtPct(day), day == null ? "" : tone(day)],
                    ["비중", totalValue > 0 ? fmtPct(p.valueKrw / totalValue, false) : "-"],
                  ]}
                />
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
