"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { deleteTransaction } from "@/app/actions";
import { CASH_LABEL, type CashFlow } from "@/lib/cash";
import { fmtFx, fmtKrw, fmtPrice, fmtQty, MARKET_LABEL } from "@/lib/format";
import { dividendNetKrw, type Dividend } from "@/lib/income";
import { currencyOf, type DisplayCurrency, type Trade } from "@/lib/portfolio";
import { useDisplayCurrency } from "./currency";
import { TrashIcon } from "./icons";
import { DetailCard, type DetailRow } from "./detail-card";
import { DeleteCashButton, EditCashButton } from "./cash-form";
import { DeleteDividendButton, EditDividendButton, type DividendStock } from "./dividend-form";
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

type Item =
  | { kind: "trade"; date: string; created: string; t: Trade }
  | { kind: "dividend"; date: string; created: string; d: Dividend }
  | { kind: "cash"; date: string; created: string; c: CashFlow };

function Badge({ label, tone }: { label: string; tone: "up" | "down" | "brand" | "muted" }) {
  const cls = { up: "bg-up/10 text-up", down: "bg-down/10 text-down", brand: "bg-brand/10 text-brand", muted: "bg-surface-2 text-ink-2" }[tone];
  return <span className={`shrink-0 whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-semibold ${cls}`}>{label}</span>;
}

const usd = (n: number) => fmtPrice(n, "USD");

/** 현금 기록의 이름·배지·금액 */
function cashView(c: CashFlow) {
  const money = (n: number, cur: "KRW" | "USD") => (cur === "USD" ? usd(n) : fmtKrw(n));
  if (c.type === "EXCHANGE") {
    const to = c.currency === "KRW" ? usd(c.amount / c.fxRate) : fmtKrw(c.amount * c.fxRate);
    return {
      title: c.currency === "KRW" ? "원화 → 달러" : "달러 → 원화",
      badge: <Badge label="환전" tone="muted" />,
      amount: `${money(c.amount, c.currency)} → ${to}`,
      value: to,
    };
  }
  return {
    title: c.currency === "USD" ? "달러" : "원화",
    badge: <Badge label={CASH_LABEL[c.type]} tone={c.type === "DEPOSIT" ? "brand" : "muted"} />,
    amount: money(c.amount, c.currency),
    value: `${c.type === "DEPOSIT" ? "+" : "-"}${money(c.amount, c.currency)}`,
  };
}

/**
 * 거래내역 목록: 매수·매도, 배당, 입출금·환전을 날짜순으로 한데 보여 준다.
 * (종목 화면 등에서는 매매 기록만 넘긴다)
 */
export function TradeList({
  trades,
  dividends = [],
  cashFlows = [],
  stocks = [],
  accounts,
  showAccount = true,
  order = "new",
  emptyText = "거래 기록이 없어요.",
}: {
  trades: Trade[];
  dividends?: Dividend[];
  cashFlows?: CashFlow[];
  /** 배당 수정용 종목 목록 */
  stocks?: DividendStock[];
  accounts: AccountOption[];
  showAccount?: boolean;
  /** 최신순(new) / 오래된순(old). trades는 이미 그 순서로 정렬돼 있어야 한다 */
  order?: "new" | "old";
  /** 기록이 없을 때 문구 (필터·검색 중이면 다르게) */
  emptyText?: string;
}) {
  const accountName = new Map(accounts.map((a) => [a.id, a.name]));
  const { currency } = useDisplayCurrency();
  // 매매는 받은 순서를 지키고(같은 날 입력 순서), 배당·현금은 날짜 기준으로 끼워 넣는다
  const items: Item[] = trades.map((t, i) => ({ kind: "trade", date: t.tradeDate, created: String(i).padStart(8, "0"), t }));
  const extra: Item[] = [
    ...dividends.map((d): Item => ({ kind: "dividend", date: d.payDate, created: "", d })),
    ...cashFlows.map((c): Item => ({ kind: "cash", date: c.date, created: "", c })),
  ];
  const sign = order === "new" ? -1 : 1;
  const all = extra.length
    ? [...items, ...extra].sort((a, b) => sign * a.date.localeCompare(b.date) || (a.kind === "trade" && b.kind === "trade" ? a.created.localeCompare(b.created) : 0))
    : items;
  if (all.length === 0) {
    return <p className="card p-8 text-center text-sm text-muted">{emptyText}</p>;
  }
  const acct = (id: string) => (showAccount ? accountName.get(id) : undefined);

  return (
    <div className="card overflow-hidden">
      {/* PC(xl 이상): 표. 좁은 화면에서는 아래 카드 목록 */}
      <table className="hidden w-full table-fixed whitespace-nowrap text-sm xl:table [&_td]:overflow-hidden [&_td]:text-ellipsis">
        <thead className="border-b border-line bg-surface-2 text-xs text-ink-2">
          <tr>
            <th className="w-32 px-4 py-2.5 text-left font-medium">날짜</th>
            {showAccount && <th className="w-28 px-3 py-2.5 text-left font-medium">계좌</th>}
            <th className="px-3 py-2.5 text-left font-medium">내용</th>
            <th className="w-20 px-3 py-2.5 text-center font-medium">구분</th>
            <th className="w-32 px-3 py-2.5 text-right font-medium">수량</th>
            <th className="w-36 px-3 py-2.5 text-right font-medium">단가</th>
            <th className="w-44 px-3 py-2.5 text-right font-medium">금액</th>
            <th className="w-20 px-2 py-2.5" />
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {all.map((it) => {
            if (it.kind === "trade") {
              const t = it.t;
              const f = tradeFigures(t, currency);
              return (
                <tr key={`t${t.id}`} className="hover:bg-surface-2/60">
                  <td className="px-4 py-3 text-ink-2">{t.tradeDate}</td>
                  {showAccount && <td className="truncate px-3 py-3 text-ink-2" title={acct(t.accountId)}>{acct(t.accountId)}</td>}
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
                    {t.market === "US" && (
                      <div className="text-xs text-muted">
                        {t.type === "BUY" ? "매수" : "매도"}환율 {fmtFx(t.fxRate)}
                      </div>
                    )}
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
            }
            if (it.kind === "dividend") {
              const d = it.d;
              const cur = d.market === "US" ? "USD" : "KRW";
              return (
                <tr key={`d${d.id}`} className="hover:bg-surface-2/60">
                  <td className="px-4 py-3 text-ink-2">{d.payDate}</td>
                  {showAccount && <td className="truncate px-3 py-3 text-ink-2" title={acct(d.accountId)}>{acct(d.accountId)}</td>}
                  <td className="px-3 py-3" title={d.name}>
                    <div className="truncate font-medium">{d.name}</div>
                    <div className="truncate text-xs text-muted">
                      세전 {fmtPrice(d.amount, cur)}
                      {d.tax ? ` · 세금 ${fmtPrice(d.tax, cur)}` : ""}
                      {d.memo ? ` · ${d.memo}` : ""}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <Badge label="배당" tone="up" />
                  </td>
                  <td className="px-3 py-3 text-right text-muted">-</td>
                  <td className="px-3 py-3 text-right text-muted">-</td>
                  <td className="px-3 py-3 text-right font-medium text-up">+{fmtKrw(dividendNetKrw(d))}</td>
                  <td className="px-2 py-3">
                    <div className="flex justify-end">
                      <EditDividendButton accounts={accounts} stocks={stocks} dividend={d} />
                      <DeleteDividendButton id={d.id} />
                    </div>
                  </td>
                </tr>
              );
            }
            const c = it.c;
            const v = cashView(c);
            return (
              <tr key={`c${c.id}`} className="hover:bg-surface-2/60">
                <td className="px-4 py-3 text-ink-2">{c.date}</td>
                {showAccount && <td className="truncate px-3 py-3 text-ink-2" title={acct(c.accountId)}>{acct(c.accountId)}</td>}
                <td className="px-3 py-3" title={v.title}>
                  <div className="truncate font-medium">{v.title}</div>
                  <div className="truncate text-xs text-muted">
                    {c.type === "EXCHANGE" ? `환율 ${fmtQty(c.fxRate)}` : "현금"}
                    {c.memo ? ` · ${c.memo}` : ""}
                  </div>
                </td>
                <td className="px-3 py-3 text-center">{v.badge}</td>
                <td className="px-3 py-3 text-right text-muted">-</td>
                <td className="px-3 py-3 text-right text-muted">-</td>
                <td className="px-3 py-3 text-right font-medium" title={v.amount}>{v.amount}</td>
                <td className="px-2 py-3">
                  <div className="flex justify-end">
                    <EditCashButton accounts={accounts} flow={c} />
                    <DeleteCashButton id={c.id} />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <ul className="divide-y divide-line xl:hidden">
        {all.map((it) => {
          if (it.kind === "trade") {
            const t = it.t;
            const f = tradeFigures(t, currency);
            const rows: DetailRow[] = [
              ["수량", `${fmtQty(t.quantity)}주`],
              ["단가", fmtPrice(f.price, f.currency)],
            ];
            if (t.market === "US") rows.push([t.type === "BUY" ? "매수환율" : "매도환율", fmtFx(t.fxRate)]);
            if (t.fee || t.tax) rows.push(["수수료·세금", fmtPrice((t.fee + t.tax) * (f.currency === "KRW" && t.market === "US" ? t.fxRate : 1), f.currency)]);
            if (t.memo) rows.push(["메모", t.memo]);
            return (
              <DetailCard
                key={`t${t.id}`}
                title={t.name}
                badge={<TypeBadge type={t.type} />}
                sub={[t.tradeDate, acct(t.accountId), MARKET_LABEL[t.market]].filter(Boolean).join(" · ")}
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
          }
          if (it.kind === "dividend") {
            const d = it.d;
            const cur = d.market === "US" ? "USD" : "KRW";
            const rows: DetailRow[] = [
              ["세전", fmtPrice(d.amount, cur)],
              ["세금", d.tax ? fmtPrice(d.tax, cur) : "-"],
            ];
            if (d.market === "US") rows.push(["환율", `${fmtQty(d.fxRate)}원`]);
            if (d.memo) rows.push(["메모", d.memo]);
            return (
              <DetailCard
                key={`d${d.id}`}
                title={d.name}
                badge={<Badge label="배당" tone="up" />}
                sub={[d.payDate, acct(d.accountId)].filter(Boolean).join(" · ")}
                value={`+${fmtKrw(dividendNetKrw(d))}`}
                valueClass="text-up"
                rows={rows}
                actions={
                  <>
                    <EditDividendButton accounts={accounts} stocks={stocks} dividend={d} />
                    <DeleteDividendButton id={d.id} />
                  </>
                }
              />
            );
          }
          const c = it.c;
          const v = cashView(c);
          const rows: DetailRow[] = c.type === "EXCHANGE" ? [["바꾼 금액", v.amount.split(" → ")[0]], ["환율", `${fmtQty(c.fxRate)}원`]] : [];
          if (c.memo) rows.push(["메모", c.memo]);
          return (
            <DetailCard
              key={`c${c.id}`}
              title={v.title}
              badge={v.badge}
              sub={[c.date, acct(c.accountId)].filter(Boolean).join(" · ")}
              value={v.value}
              rows={rows}
              actions={
                <>
                  <EditCashButton accounts={accounts} flow={c} />
                  <DeleteCashButton id={c.id} />
                </>
              }
            />
          );
        })}
      </ul>
    </div>
  );
}
