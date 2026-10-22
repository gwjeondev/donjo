"use client";

import { useTransition } from "react";
import { deleteTransaction } from "@/app/actions";
import { fmtKrw, fmtPrice, fmtQty, MARKET_LABEL } from "@/lib/format";
import { currencyOf, type Trade } from "@/lib/portfolio";
import { TrashIcon } from "./icons";
import { EditTradeButton } from "./trade-form";

interface AccountOption {
  id: string;
  name: string;
}

function DeleteButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      className="rounded-md p-1.5 text-muted hover:bg-up/10 hover:text-up disabled:opacity-40"
      aria-label="삭제"
      disabled={pending}
      onClick={() => {
        if (!confirm("이 매매 기록을 삭제할까요?")) return;
        start(async () => {
          const res = await deleteTransaction(id);
          if (res.error) alert(res.error);
        });
      }}
    >
      <TrashIcon className="size-4" />
    </button>
  );
}

const amountKrw = (t: Trade) => {
  const fx = currencyOf(t.market) === "USD" ? t.fxRate : 1;
  return t.quantity * t.price * fx;
};

function TypeBadge({ type }: { type: Trade["type"] }) {
  return (
    <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${type === "BUY" ? "bg-up/10 text-up" : "bg-down/10 text-down"}`}>
      {type === "BUY" ? "매수" : "매도"}
    </span>
  );
}

export function TradeList({ trades, accounts, showAccount = true }: { trades: Trade[]; accounts: AccountOption[]; showAccount?: boolean }) {
  const accountName = new Map(accounts.map((a) => [a.id, a.name]));
  if (trades.length === 0) {
    return <p className="card p-8 text-center text-sm text-muted">매매 기록이 없습니다.</p>;
  }
  return (
    <div className="card overflow-hidden">
      <table className="hidden w-full text-sm md:table">
        <thead className="border-b border-line bg-surface-2 text-xs text-ink-2">
          <tr>
            <th className="px-4 py-2.5 text-left font-medium">거래일</th>
            {showAccount && <th className="px-4 py-2.5 text-left font-medium">계좌</th>}
            <th className="px-4 py-2.5 text-left font-medium">종목</th>
            <th className="px-4 py-2.5 text-center font-medium">구분</th>
            <th className="px-4 py-2.5 text-right font-medium">수량</th>
            <th className="px-4 py-2.5 text-right font-medium">단가</th>
            <th className="px-4 py-2.5 text-right font-medium">거래금액</th>
            <th className="w-20 px-2 py-2.5" />
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {trades.map((t) => (
            <tr key={t.id} className="hover:bg-surface-2/60">
              <td className="px-4 py-3 text-ink-2">{t.tradeDate}</td>
              {showAccount && <td className="px-4 py-3 text-ink-2">{accountName.get(t.accountId)}</td>}
              <td className="px-4 py-3">
                <div className="font-medium">{t.name}</div>
                <div className="text-xs text-muted">
                  {MARKET_LABEL[t.market]}
                  {t.memo ? ` · ${t.memo}` : ""}
                </div>
              </td>
              <td className="px-4 py-3 text-center"><TypeBadge type={t.type} /></td>
              <td className="px-4 py-3 text-right">{fmtQty(t.quantity)}</td>
              <td className="px-4 py-3 text-right">
                {fmtPrice(t.price, currencyOf(t.market))}
                {t.market === "US" && <div className="text-xs text-muted">@{fmtQty(t.fxRate)}</div>}
              </td>
              <td className="px-4 py-3 text-right font-medium">{fmtKrw(amountKrw(t))}</td>
              <td className="px-2 py-3">
                <div className="flex justify-end">
                  <EditTradeButton accounts={accounts} trade={t} />
                  <DeleteButton id={t.id} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <ul className="divide-y divide-line md:hidden">
        {trades.map((t) => (
          <li key={t.id} className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <TypeBadge type={t.type} />
                <span className="truncate font-medium">{t.name}</span>
              </div>
              <div className="mt-0.5 text-xs text-muted">
                {t.tradeDate}
                {showAccount && ` · ${accountName.get(t.accountId)}`} · {fmtQty(t.quantity)}주 × {fmtPrice(t.price, currencyOf(t.market))}
              </div>
            </div>
            <div className="text-right text-sm font-medium">{fmtKrw(amountKrw(t))}</div>
            <div className="flex">
              <EditTradeButton accounts={accounts} trade={t} />
              <DeleteButton id={t.id} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
