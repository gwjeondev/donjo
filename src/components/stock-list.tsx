"use client";

import Link from "next/link";
import { useState } from "react";
import { fmtKrw, fmtPct, fmtQty, fmtSigned, tone } from "@/lib/format";
import type { ValuedPosition } from "@/lib/portfolio";
import { HOLDING_SORTS, sortBy, type HoldingSortKey, type Sort } from "@/lib/prefs";
import { ChevronRightIcon } from "./icons";
import { SortControl } from "./sort-control";

const VALUE: Record<HoldingSortKey, (p: ValuedPosition) => number | string> = {
  value: (p) => p.valueKrw,
  returnRate: (p) => p.returnRate,
  pnl: (p) => p.unrealizedPnlKrw,
  realized: (p) => p.realizedPnlKrw,
  dayChange: (p) => (p.price != null && p.previousClose ? p.price / p.previousClose - 1 : 0),
  name: (p) => p.name,
};

/** 종목 카드 목록 (계좌 목록과 같은 모양). 기본은 보유 중인 종목, 다 판 종목은 따로 펼쳐 본다 */
export function StockList({ positions, sort: initialSort }: { positions: ValuedPosition[]; sort: Sort<HoldingSortKey> }) {
  const [sort, setSort] = useState(initialSort);
  const [showSold, setShowSold] = useState(false);
  const held = positions.filter((p) => p.quantity > 0);
  const sold = positions.filter((p) => p.quantity <= 0);
  const shown = sortBy(showSold ? [...held, ...sold] : held, (p) => VALUE[sort.key](p), sort.dir);

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        {sold.length > 0 ? (
          <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-2">
            <input type="checkbox" checked={showSold} onChange={(e) => setShowSold(e.target.checked)} className="size-4 accent-brand" />
            다 판 종목도 보기 ({sold.length})
          </label>
        ) : (
          <span />
        )}
        {shown.length > 1 && <SortControl options={HOLDING_SORTS} value={sort} onChange={setSort} />}
      </div>
      {shown.length === 0 ? (
        <p className="card p-8 text-center text-sm text-muted">보유 중인 종목이 없어요.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((p) => {
            const day = p.price != null && p.previousClose ? p.price / p.previousClose - 1 : null;
            const isSold = p.quantity <= 0;
            return (
              <Link
                key={p.symbol}
                href={`/stocks/${encodeURIComponent(p.symbol)}`}
                className={`card block min-w-0 p-5 transition hover:border-brand/50 ${isSold ? "opacity-70" : ""}`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <h2 className="min-w-0 truncate font-semibold" title={p.name}>
                    {p.name}
                  </h2>
                  <ChevronRightIcon className="size-4 shrink-0 text-muted" />
                </div>
                {isSold ? (
                  <p className="mt-3 text-2xl font-bold text-muted">보유 없음</p>
                ) : (
                  <>
                    <p className="mt-3 text-2xl font-bold">{fmtKrw(p.valueKrw)}</p>
                    <p className={`mt-1 text-sm ${tone(p.unrealizedPnlKrw)}`}>
                      {fmtSigned(p.unrealizedPnlKrw)} ({fmtPct(p.returnRate)})
                    </p>
                    {day != null && (
                      <p className="mt-1 truncate text-xs text-ink-2">
                        오늘{" "}
                        <span className={tone(p.dayChangeKrw)}>
                          {fmtSigned(p.dayChangeKrw)} ({fmtPct(day)})
                        </span>
                      </p>
                    )}
                  </>
                )}
                <p className="mt-3 truncate text-xs text-muted">
                  {isSold ? "다 팔았어요" : `${fmtQty(p.quantity)}주`}
{" "}
                  · 실현손익 <span className={tone(p.realizedPnlKrw)}>{fmtSigned(p.realizedPnlKrw)}</span>
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
