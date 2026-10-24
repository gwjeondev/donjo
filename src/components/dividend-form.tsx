"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { deleteDividend, saveDividend } from "@/app/actions";
import { fmtKrw, fmtPrice, MARKET_LABEL } from "@/lib/format";
import { useFormAction } from "@/lib/hooks/use-form-action";
import type { Dividend } from "@/lib/income";
import type { Market } from "@/lib/portfolio";
import { EditIcon, PlusIcon, TrashIcon } from "./icons";
import { Dialog } from "./trade-form";

interface AccountOption {
  id: string;
  name: string;
}

/** 배당을 입력할 수 있는 종목: 그 계좌에서 거래한 적이 있는 종목 */
export interface DividendStock {
  accountId: string;
  symbol: string;
  name: string;
  market: Market;
}

const today = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
const stockValue = (s: { symbol: string; market: Market; name: string }) => `${s.symbol}|${s.market}|${s.name}`;
const toNum = (v: string) => Number(v.replaceAll(",", "")) || 0;

function DividendForm({
  accounts,
  stocks,
  defaultAccountId,
  initial,
  onDone,
}: {
  accounts: AccountOption[];
  stocks: DividendStock[];
  defaultAccountId?: string;
  initial?: Dividend;
  onDone: () => void;
}) {
  const { state, pending, onSubmit } = useFormAction(saveDividend);
  useEffect(() => {
    if (state.ok) onDone();
  }, [state, onDone]);

  const [accountId, setAccountId] = useState(initial?.accountId ?? defaultAccountId ?? accounts[0]?.id ?? "");
  const options = useMemo(() => stocks.filter((s) => s.accountId === accountId), [stocks, accountId]);
  const [stock, setStock] = useState(initial ? stockValue(initial) : "");
  // 계좌를 바꿔서 고른 종목이 목록에 없으면 첫 종목으로
  const selected = options.find((o) => stockValue(o) === stock) ?? options[0];
  const market = selected?.market;
  const unit = market === "US" ? "USD" : "원";

  const [payDate, setPayDate] = useState(initial?.payDate ?? today());
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
  const [tax, setTax] = useState(initial?.tax ? String(initial.tax) : "");
  const [fxRate, setFxRate] = useState(initial && initial.market === "US" ? String(initial.fxRate) : "");
  const fxTouched = useRef(!!initial);

  // 미국 주식은 지급일 환율을 자동으로 채운다 (직접 고치면 유지)
  useEffect(() => {
    if (market !== "US" || fxTouched.current) return;
    const ctrl = new AbortController();
    fetch(`/api/fx?date=${payDate}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((j) => j.rate && !fxTouched.current && setFxRate(String(Math.round(j.rate * 100) / 100)))
      .catch(() => {});
    return () => ctrl.abort();
  }, [market, payDate]);

  const net = Math.max(toNum(amount) - toNum(tax), 0);
  const netKrw = market === "US" ? net * toNum(fxRate) : net;

  return (
    <form method="post" onSubmit={onSubmit} className="space-y-4">
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <div>
        <label className="label" htmlFor="div-account">
          계좌
        </label>
        <select id="div-account" name="accountId" className="input" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="div-stock">
          종목
        </label>
        {options.length === 0 ? (
          <p className="rounded-lg bg-surface-2 px-3 py-2.5 text-sm text-ink-2">이 계좌에는 거래한 종목이 없어요. 먼저 매수 기록을 추가해 주세요.</p>
        ) : (
          <select
            id="div-stock"
            name="stock"
            className="input"
            value={selected ? stockValue(selected) : ""}
            onChange={(e) => setStock(e.target.value)}
          >
            {options.map((o) => (
              <option key={o.symbol} value={stockValue(o)}>
                {o.name} ({MARKET_LABEL[o.market]} · {o.symbol.replace(/\.(KS|KQ)$/, "")})
              </option>
            ))}
          </select>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="payDate">
            지급일
          </label>
          <input id="payDate" name="payDate" type="date" className="input" required value={payDate} max={today()} onChange={(e) => setPayDate(e.target.value)} />
        </div>
        {market === "US" ? (
          <div>
            <label className="label" htmlFor="div-fx">
              환율 (원/USD)
            </label>
            <input
              id="div-fx"
              name="fxRate"
              inputMode="decimal"
              className="input text-right"
              required
              value={fxRate}
              onChange={(e) => {
                fxTouched.current = true;
                setFxRate(e.target.value);
              }}
            />
          </div>
        ) : (
          <div />
        )}
        <div>
          <label className="label" htmlFor="amount">
            배당금 세전 ({unit})
          </label>
          <input id="amount" name="amount" inputMode="decimal" className="input text-right" required value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="div-tax">
            세금 ({unit})
          </label>
          <input id="div-tax" name="tax" inputMode="decimal" className="input text-right" placeholder="0" value={tax} onChange={(e) => setTax(e.target.value)} />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="div-memo">
          메모
        </label>
        <input id="div-memo" name="memo" className="input" defaultValue={initial?.memo ?? ""} placeholder="분기 배당 등" />
      </div>
      <div className="flex items-baseline justify-between rounded-lg bg-surface-2 px-3 py-2.5 text-sm">
        <span className="text-ink-2">받은 금액 (세후)</span>
        <span className="font-semibold">
          {market === "US" ? `${fmtPrice(net, "USD")} · ` : ""}
          {fmtKrw(netKrw)}
        </span>
      </div>
      {state.error && <p className="text-sm text-up">{state.error}</p>}
      <button className="btn-primary w-full py-2.5" disabled={pending || options.length === 0}>
        {pending ? "저장 중…" : initial ? "수정하기" : "배당 기록 추가"}
      </button>
    </form>
  );
}

export function AddDividendButton({
  accounts,
  stocks,
  defaultAccountId,
}: {
  accounts: AccountOption[];
  stocks: DividendStock[];
  defaultAccountId?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn-primary" onClick={() => setOpen(true)} disabled={accounts.length === 0}>
        <PlusIcon className="size-4" /> 배당
      </button>
      <Dialog title="배당금 추가" open={open} onClose={() => setOpen(false)}>
        <DividendForm accounts={accounts} stocks={stocks} defaultAccountId={defaultAccountId} onDone={() => setOpen(false)} />
      </Dialog>
    </>
  );
}

export function EditDividendButton({ accounts, stocks, dividend }: { accounts: AccountOption[]; stocks: DividendStock[]; dividend: Dividend }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-ink" onClick={() => setOpen(true)} aria-label="수정">
        <EditIcon className="size-4" />
      </button>
      <Dialog title="배당금 수정" open={open} onClose={() => setOpen(false)}>
        <DividendForm accounts={accounts} stocks={stocks} initial={dividend} onDone={() => setOpen(false)} />
      </Dialog>
    </>
  );
}

export function DeleteDividendButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      className="rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-up disabled:opacity-50"
      aria-label="삭제"
      disabled={pending}
      onClick={() => {
        if (!confirm("이 배당 기록을 삭제할까요?")) return;
        start(async () => {
          const res = await deleteDividend(id);
          if (res.error) alert(res.error);
          else router.refresh();
        });
      }}
    >
      <TrashIcon className="size-4" />
    </button>
  );
}
