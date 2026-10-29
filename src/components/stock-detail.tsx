"use client";

import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmtFx, fmtPct, fmtPrice, fmtQty, fmtSigned, tone } from "@/lib/format";
import { avgBuyFxRate, displayFigures, unrealizedFxKrw, type ValuedPosition } from "@/lib/portfolio";
import { CurrencyToggle, useDisplayCurrency } from "./currency";
import { DetailCard } from "./detail-card";

const signed = (n: number, c: "KRW" | "USD") => `${n > 0 ? "+" : n < 0 ? "-" : ""}${fmtPrice(Math.abs(n), c)}`;

/** 종목 요약: 보유수량·평단·평가금액·손익 (해외 종목은 원화/달러 전환) */
export function StockSummary({ position, usdKrw }: { position: ValuedPosition; usdKrw: number }) {
  const { currency } = useDisplayCurrency();
  const d = displayFigures(position, currency, usdKrw);
  const realized = d.currency === "USD" ? position.realizedPnl : position.realizedPnlKrw;
  const dayRate = position.price != null && position.previousClose ? position.price / position.previousClose - 1 : null;
  const dayUsd = position.price != null && position.previousClose != null ? position.quantity * (position.price - position.previousClose) : 0;
  const buyFx = avgBuyFxRate(position);
  const fxPnl = unrealizedFxKrw(position, usdKrw);
  const items: { label: string; value: string; sub?: string; tone?: number }[] = [
    { label: "보유수량", value: `${fmtQty(position.quantity)}주` },
    { label: "평균단가", value: position.quantity > 0 ? fmtPrice(d.avgCost, d.currency) : "-" },
    { label: "평가금액", value: fmtPrice(d.value, d.currency) },
    // 오늘 등락: 보유 수량 × (현재가 − 전일 종가). 달러로 보면 달러 금액
    ...(position.quantity > 0 && dayRate != null
      ? [{ label: "오늘", value: signed(d.currency === "USD" ? dayUsd : position.dayChangeKrw, d.currency), sub: fmtPct(dayRate), tone: position.dayChangeKrw }]
      : []),
    {
      label: "평가손익",
      value: signed(d.pnl, d.currency),
      sub: position.quantity > 0 ? fmtPct(d.returnRate) : undefined,
      tone: d.pnl,
    },
    { label: "실현손익", value: signed(realized, d.currency), tone: realized },
    // 환차손익은 원화 개념이라 통화 전환과 관계없이 원화로 보여 준다
    ...(buyFx != null
      ? [
          { label: "환차손익", value: fmtSigned(fxPnl), sub: "보유분", tone: fxPnl },
          { label: "평균 매수환율", value: fmtFx(buyFx) },
        ]
      : []),
    ...(position.currency === "USD" && position.realizedFxKrw !== 0
      ? [{ label: "실현 환차손익", value: fmtSigned(position.realizedFxKrw), tone: position.realizedFxKrw }]
      : []),
  ];
  return (
    <section>
      {position.currency === "USD" && (
        <div className="mb-2 flex justify-end">
          <CurrencyToggle />
        </div>
      )}
      <div className="card @container">
        {/* 카드 폭에 맞춰 2·3·6열 (값이 잘리지 않게) */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-4 p-5 @xl:grid-cols-3 @5xl:grid-cols-6">
          {items.map((it) => (
            <div key={it.label} className="min-w-0">
              <p className="text-xs text-ink-2">{it.label}</p>
              <p
                className={`mt-1 whitespace-nowrap text-base font-semibold sm:text-lg ${it.tone != null ? tone(it.tone) : ""}`}
              >
                {it.value}
              </p>
              {it.sub && <p className={`text-xs ${tone(it.tone ?? 0)}`}>{it.sub}</p>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export interface PricePoint {
  date: string;
  close: number;
  buy?: number;
  sell?: number;
}

/** 가격 추이 + 내 평균단가(점선) + 매수(빨강)/매도(파랑) 지점 */
export function StockPriceChart({
  points,
  avgCost,
  currency,
}: {
  points: PricePoint[];
  avgCost: number | null;
  currency: "KRW" | "USD";
}) {
  if (points.length < 2) {
    return <p className="card p-8 text-center text-sm text-muted">가격 기록이 아직 충분하지 않아요</p>;
  }
  const short = (v: number) => (currency === "USD" ? `$${v.toFixed(0)}` : `${(v / 1000).toFixed(0)}천`);
  return (
    <div className="card p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">가격 추이</h2>
        <div className="flex items-center gap-3 text-xs text-ink-2">
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-full bg-up" /> 매수
          </span>
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-full bg-down" /> 매도
          </span>
          {avgCost != null && (
            <span className="flex items-center gap-1">
              <span className="w-3 border-t-2 border-dashed border-muted" /> 평균단가
            </span>
          )}
        </div>
      </div>
      <div className="h-64">
        <ResponsiveContainer>
          <LineChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="date"
              tickFormatter={(d: string) => d.slice(2).replaceAll("-", ".")}
              tick={{ fontSize: 11, fill: "var(--muted)" }}
              tickLine={false}
              axisLine={false}
              minTickGap={40}
            />
            <YAxis
              tickFormatter={short}
              tick={{ fontSize: 11, fill: "var(--muted)" }}
              tickLine={false}
              axisLine={false}
              width={48}
              domain={["auto", "auto"]}
            />
            {avgCost != null && <ReferenceLine y={avgCost} stroke="var(--muted)" strokeDasharray="4 4" />}
            <Tooltip
              cursor={{ stroke: "var(--muted)", strokeDasharray: "3 3" }}
              content={({ active, payload }) => {
                const p = active && (payload?.[0]?.payload as PricePoint | undefined);
                if (!p) return null;
                return (
                  <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-sm">
                    <div className="text-muted">{p.date}</div>
                    <div className="mt-0.5 font-semibold text-ink">{fmtPrice(p.close, currency)}</div>
                    {p.buy != null && <div className="text-up">매수 {fmtPrice(p.buy, currency)}</div>}
                    {p.sell != null && <div className="text-down">매도 {fmtPrice(p.sell, currency)}</div>}
                  </div>
                );
              }}
            />
            <Line
              type="monotone"
              dataKey="close"
              stroke="var(--series-1)"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              dataKey="buy"
              stroke="none"
              dot={{ r: 5, fill: "var(--up)", stroke: "var(--surface)", strokeWidth: 2 }}
              activeDot={false}
              isAnimationActive={false}
            />
            <Line
              dataKey="sell"
              stroke="none"
              dot={{ r: 5, fill: "var(--down)", stroke: "var(--surface)", strokeWidth: 2 }}
              activeDot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/** 계좌별 보유 현황 */
export function AccountBreakdown({
  rows,
  usdKrw,
}: {
  rows: (ValuedPosition & { accountName: string })[];
  usdKrw: number;
}) {
  const { currency } = useDisplayCurrency();
  const held = rows.filter((r) => r.quantity > 0);
  if (held.length === 0) return null;
  return (
    <section>
      <h2 className="mb-2 font-semibold">계좌별 보유</h2>
      <ul className="card divide-y divide-line">
        {held.map((p) => {
          const d = displayFigures(p, currency, usdKrw);
          return (
            <DetailCard
              key={p.accountId}
              title={p.accountName}
              value={fmtPrice(d.value, d.currency)}
              rows={[
                ["평가손익", signed(d.pnl, d.currency), tone(d.pnl)],
                ["수익률", fmtPct(d.returnRate), tone(d.returnRate)],
                ["보유수량", `${fmtQty(p.quantity)}주`],
                ["평단가", fmtPrice(d.avgCost, d.currency)],
                ...(avgBuyFxRate(p) != null
                  ? ([
                      ["환차손익", fmtSigned(unrealizedFxKrw(p, usdKrw)), tone(unrealizedFxKrw(p, usdKrw))],
                      ["평균 매수환율", fmtFx(avgBuyFxRate(p)!)],
                    ] as [string, string, string?][])
                  : []),
              ]}
            />
          );
        })}
      </ul>
    </section>
  );
}
