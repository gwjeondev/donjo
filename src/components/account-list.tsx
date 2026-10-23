"use client";

import Link from "next/link";
import { useState } from "react";
import { fmtKrw, fmtPct, fmtSigned, tone } from "@/lib/format";
import type { Summary } from "@/lib/portfolio";
import { ACCOUNT_SORTS, sortBy, type AccountSortKey, type Sort } from "@/lib/prefs";
import { SortControl } from "./sort-control";

export interface AccountCard {
  id: string;
  name: string;
  broker: string | null;
  /** 만든 순서 (0부터) */
  order: number;
  count: number;
  summary: Summary;
}

const ACCOUNT_VALUE: Record<AccountSortKey, (a: AccountCard) => number | string> = {
  created: (a) => a.order,
  value: (a) => a.summary.valueKrw,
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
              <span className="shrink-0 text-xs text-muted">{a.broker ?? ""}</span>
            </div>
            <p className="mt-3 text-2xl font-bold">{fmtKrw(a.summary.valueKrw)}</p>
            <p className={`mt-1 text-sm ${tone(a.summary.unrealizedPnlKrw)}`}>
              {fmtSigned(a.summary.unrealizedPnlKrw)} ({fmtPct(a.summary.returnRate)})
            </p>
            <p className="mt-3 text-xs text-muted">
              보유 {a.count}종목 · 실현손익{" "}
              <span className={tone(a.summary.realizedPnlKrw)}>{fmtSigned(a.summary.realizedPnlKrw)}</span>
            </p>
          </Link>
        ))}
      </div>
    </>
  );
}
