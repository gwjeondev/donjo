"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { deleteTransaction } from "@/app/actions";
import { fmtPrice, fmtQty, MARKET_LABEL } from "@/lib/format";
import { currencyOf, type DisplayCurrency, type Trade } from "@/lib/portfolio";
import { useDisplayCurrency } from "./currency";
import { TrashIcon } from "./icons";
import { DetailCard, type DetailRow } from "./detail-card";
import { EditTradeButton } from "./trade-form";

interface AccountOption {
  id: string;
  name: string;
}

function DeleteButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
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
          else router.refresh();
        });
      }}
    >
      <TrashIcon className="size-4" />
    </button>
  );
}

/** 해외 종목은 선택한 통화로 (원화 환산은 거래 시점 환율), 국내 종목은 원화로 */
function tradeFigures(t: Trade, mode: DisplayCurrency) {
  const usd = currencyOf(t.market) === "USD";
  const currency: "KRW" | "USD" = usd && mode === "USD" ? "USD" : "KRW";
  const fx = usd && currency === "KRW" ? t.fxRate : 1;
  return { currency, price: t.price * fx, amount: t.quantity * t.price * fx };
}

function TypeBadge({ type }: { type: Trade["type"] }) {
  return (
    <span
      className={`shrink-0 whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-semibold ${type === "BUY" ? "bg-up/10 text-up" : "bg-down/10 text-down"}`}
    >
      {type === "BUY" ? "매수" : "매도"}
    </span>
  );
}

export function TradeList({
  trades,
  accounts,
  showAccount = true,
  emptyText = "매매 기록이 없어요.",
}: {
  trades: Trade[];
  accounts: AccountOption[];
  showAccount?: boolean;
  /** 기록이 없을 때 문구 (필터·검색 중이면 다르게) */
  emptyText?: string;
}) {
  const accountName = new Map(accounts.map((a) => [a.id, a.name]));
  const { currency } = useDisplayCurrency();
  if (trades.length === 0) {
    return <p className="card p-8 text-center text-sm text-muted">{emptyText}</p>;
  }
  return (
    <div className="card overflow-hidden">
      {/* PC(xl 이상): 표. 좁은 화면에서는 아래 카드 목록 */}
      <table className="hidden w-full table-fixed whitespace-nowrap text-sm xl:table [&_td]:overflow-hidden [&_td]:text-ellipsis">
        <thead className="border-b border-line bg-surface-2 text-xs text-ink-2">
          <tr>
            <th className="w-32 px-4 py-2.5 text-left font-medium">거래일</th>
            {showAccount && <th className="w-28 px-3 py-2.5 text-left font-medium">계좌</th>}
            <th className="px-3 py-2.5 text-left font-medium">종목</th>
            <th className="w-20 px-3 py-2.5 text-center font-medium">구분</th>
            <th className="w-32 px-3 py-2.5 text-right font-medium">수량</th>
            <th className="w-36 px-3 py-2.5 text-right font-medium">단가</th>
            <th className="w-40 px-3 py-2.5 text-right font-medium">거래금액</th>
            <th className="w-20 px-2 py-2.5" />
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {trades.map((t) => {
            const f = tradeFigures(t, currency);
            return (
              <tr key={t.id} className="hover:bg-surface-2/60">
                <td className="px-4 py-3 text-ink-2">{t.tradeDate}</td>
                {showAccount && (
                  <td className="truncate px-3 py-3 text-ink-2" title={accountName.get(t.accountId)}>
                    {accountName.get(t.accountId)}
                  </td>
                )}
                <td className="px-3 py-3" title={t.name}>
                  <div className="truncate font-medium">{t.name}</div>
                  <div className="truncate text-xs text-muted">
                    {MARKET_LABEL[t.market]}
                    {t.memo ? ` · ${t.memo}` : ""}
                  </div>
                </td>
                <td className="px-3 py-3 text-center">
                  <TypeBadge type={t.type} />
                </td>
                <td className="px-3 py-3 text-right">{fmtQty(t.quantity)}</td>
                <td className="px-3 py-3 text-right">
                  {fmtPrice(f.price, f.currency)}
                  {t.market === "US" && <div className="text-xs text-muted">@{fmtQty(t.fxRate)}</div>}
                </td>
                <td className="px-3 py-3 text-right font-medium">{fmtPrice(f.amount, f.currency)}</td>
                <td className="px-2 py-3">
                  <div className="flex justify-end">
                    <EditTradeButton accounts={accounts} trade={t} />
                    <DeleteButton id={t.id} />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <ul className="divide-y divide-line xl:hidden">
        {trades.map((t) => {
          const f = tradeFigures(t, currency);
          const rows: DetailRow[] = [
            ["수량", `${fmtQty(t.quantity)}주`],
            ["단가", fmtPrice(f.price, f.currency)],
          ];
          if (t.market === "US") rows.push(["환율", `${fmtQty(t.fxRate)}원`]);
          if (t.fee || t.tax) rows.push(["수수료·세금", fmtPrice((t.fee + t.tax) * (f.currency === "KRW" && t.market === "US" ? t.fxRate : 1), f.currency)]);
          if (t.memo) rows.push(["메모", t.memo]);
          return (
            <DetailCard
              key={t.id}
              title={t.name}
              badge={<TypeBadge type={t.type} />}
              sub={`${t.tradeDate}${showAccount ? ` · ${accountName.get(t.accountId)}` : ""} · ${MARKET_LABEL[t.market]}`}
              value={fmtPrice(f.amount, f.currency)}
              rows={rows}
              actions={
                <>
                  <EditTradeButton accounts={accounts} trade={t} />
                  <DeleteButton id={t.id} />
                </>
              }
            />
          );
        })}
      </ul>
    </div>
  );
}
