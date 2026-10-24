"use client";

import Link from "next/link";
import { useState } from "react";
import { fmtKrw, fmtPct, fmtSigned, tone } from "@/lib/format";
import type { Summary } from "@/lib/portfolio";
import { ACCOUNT_SORTS, sortBy, type AccountSortKey, type Sort } from "@/lib/prefs";
import { ChevronRightIcon } from "./icons";
import { SortControl } from "./sort-control";

export interface AccountCard {
  id: string;
  name: string;
  broker: string | null;
  /** 만든 순서 (0부터) */
  order: number;
  count: number;
  summary: Summary;
  /** 현금 (원화 환산). 기록이 없으면 null */
  cashKrw: number | null;
}

const ACCOUNT_VALUE: Record<AccountSortKey, (a: AccountCard) => number | string> = {
  created: (a) => a.order,
  value: (a) => a.summary.valueKrw + (a.cashKrw ?? 0),
  returnRate: (a) => a.summary.returnRate,
  pnl: (a) => a.summary.unrealizedPnlKrw,
  realized: (a) => a.summary.realizedPnlKrw,
  name: (a) => a.name,
};

/** 계좌 카드 목록. 기본 정렬은 설정에서, 여기서 바꾼 정렬은 이 화면에서만 쓴다 */
export function AccountList({ accounts, sort: initialSort }: { accounts: AccountCard[]; sort: Sort<AccountSortKey> }) {
  const [sort, setSort] = useState(initialSort);
  const sorted = sortBy(accounts, (a) => ACCOUNT_VALUE[sort.key](a), sort.dir);
  return (
    <>
      {accounts.length > 1 && (
        <div className="mb-3 flex justify-end">
          <SortControl options={ACCOUNT_SORTS} value={sort} onChange={setSort} />
        </div>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.map((a) => (
          <Link key={a.id} href={`/accounts/${a.id}`} className="card block p-5 transition hover:border-brand/50">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="truncate font-semibold">{a.name}</h2>
              <span className="flex shrink-0 items-center gap-0.5 text-xs text-muted">
                {a.broker ?? ""}
                <ChevronRightIcon className="size-4" />
              </span>
            </div>
            <p className="mt-3 text-2xl font-bold">{fmtKrw(a.summary.valueKrw + (a.cashKrw ?? 0))}</p>
            <p className={`mt-1 text-sm ${tone(a.summary.unrealizedPnlKrw)}`}>
              {fmtSigned(a.summary.unrealizedPnlKrw)} ({fmtPct(a.summary.returnRate)})
            </p>
            <p className="mt-3 text-xs text-muted">
              보유 {a.count}종목{a.cashKrw != null && <> · 현금 {fmtKrw(a.cashKrw)}</>} · 실현손익{" "}
              <span className={tone(a.summary.realizedPnlKrw)}>{fmtSigned(a.summary.realizedPnlKrw)}</span>
            </p>
          </Link>
        ))}
      </div>
    </>
  );
}
