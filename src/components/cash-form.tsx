"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { deleteCashFlow, saveCashFlow } from "@/app/actions";
import type { CashFlow, CashType } from "@/lib/cash";
import { fmtKrw, fmtPrice } from "@/lib/format";
import { useFormAction } from "@/lib/hooks/use-form-action";
import { EditIcon, TrashIcon } from "./icons";
import { Dialog } from "./trade-form";

const today = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
const toNum = (v: string) => Number(v.replaceAll(",", "")) || 0;

/** 현금 입금·출금·환전 입력. 환전은 보낸 통화와 금액, 환율을 넣는다 */
export function CashForm({
  accounts,
  defaultAccountId,
  initial,
  onDone,
}: {
  accounts: { id: string; name: string }[];
  defaultAccountId?: string;
  initial?: CashFlow;
  onDone: () => void;
}) {
  const { state, pending, onSubmit } = useFormAction(saveCashFlow);
  useEffect(() => {
    if (state.ok) onDone();
  }, [state, onDone]);
  const [type, setType] = useState<CashType>(initial?.type ?? "DEPOSIT");
  const [currency, setCurrency] = useState<"KRW" | "USD">(initial?.currency ?? "KRW");
  const [date, setDate] = useState(initial?.date ?? today());
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
  const [fxRate, setFxRate] = useState(initial?.type === "EXCHANGE" ? String(initial.fxRate) : "");
  const fxTouched = useRef(initial?.type === "EXCHANGE");

  // 환전은 그날 환율을 자동으로 채운다 (직접 고치면 유지)
  useEffect(() => {
    if (type !== "EXCHANGE" || fxTouched.current) return;
    const ctrl = new AbortController();
    fetch(`/api/fx?date=${date}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((j) => j.rate && !fxTouched.current && setFxRate(String(Math.round(j.rate * 100) / 100)))
      .catch(() => {});
    return () => ctrl.abort();
  }, [type, date]);

  const unit = currency === "USD" ? "USD" : "원";
  const converted = currency === "KRW" ? toNum(amount) / (toNum(fxRate) || 1) : toNum(amount) * toNum(fxRate);

  return (
    <form method="post" onSubmit={onSubmit} className="space-y-4">
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="currency" value={currency} />
      <div className="grid grid-cols-3 gap-1 rounded-lg bg-surface-2 p-1">
        {(["DEPOSIT", "WITHDRAW", "EXCHANGE"] as const).map((t) => (
          <button
            type="button"
            key={t}
            onClick={() => setType(t)}
            className={`rounded-md py-2 text-sm font-semibold transition ${type === t ? "bg-surface text-ink shadow-sm" : "text-ink-2"}`}
          >
            {t === "DEPOSIT" ? "입금" : t === "WITHDRAW" ? "출금" : "환전"}
          </button>
        ))}
      </div>
      <div>
        <label className="label" htmlFor="cash-account">
          계좌
        </label>
        <select id="cash-account" name="accountId" className="input" defaultValue={initial?.accountId ?? defaultAccountId ?? accounts[0]?.id}>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <span className="label">{type === "EXCHANGE" ? "바꿀 방향" : "통화"}</span>
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-surface-2 p-1" role="radiogroup">
          {(["KRW", "USD"] as const).map((c) => (
            <button
              type="button"
              key={c}
              role="radio"
              aria-checked={currency === c}
              onClick={() => setCurrency(c)}
              className={`rounded-md py-2 text-sm font-medium ${currency === c ? "bg-surface text-ink shadow-sm" : "text-ink-2"}`}
            >
              {type === "EXCHANGE" ? (c === "KRW" ? "원화 → 달러" : "달러 → 원화") : c === "KRW" ? "원화" : "달러"}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="cash-date">
            날짜
          </label>
          <input id="cash-date" name="date" type="date" className="input" required value={date} max={today()} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="cash-amount">
            {type === "EXCHANGE" ? "바꾼 금액" : "금액"} ({unit})
          </label>
          <input id="cash-amount" name="amount" inputMode="decimal" className="input text-right" required value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        {type === "EXCHANGE" && (
          <div className="col-span-2">
            <label className="label" htmlFor="cash-fx">
              환율 (원/USD)
            </label>
            <input
              id="cash-fx"
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
        )}
      </div>
      <div>
        <label className="label" htmlFor="cash-memo">
          메모
        </label>
        <input id="cash-memo" name="memo" className="input" defaultValue={initial?.memo ?? ""} placeholder="월급 입금 등" />
      </div>
      {type === "EXCHANGE" && toNum(amount) > 0 && toNum(fxRate) > 0 && (
        <div className="flex items-baseline justify-between rounded-lg bg-surface-2 px-3 py-2.5 text-sm">
          <span className="text-ink-2">받는 금액</span>
          <span className="font-semibold">{currency === "KRW" ? fmtPrice(converted, "USD") : fmtKrw(converted)}</span>
        </div>
      )}
      {state.error && <p className="text-sm text-up">{state.error}</p>}
      <button className="btn-primary w-full py-2.5" disabled={pending || accounts.length === 0}>
        {pending ? "저장 중…" : initial ? "수정하기" : `${type === "DEPOSIT" ? "입금" : type === "WITHDRAW" ? "출금" : "환전"} 기록 추가`}
      </button>
    </form>
  );
}

export function EditCashButton({ accounts, flow }: { accounts: { id: string; name: string }[]; flow: CashFlow }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-ink" onClick={() => setOpen(true)} aria-label="수정">
        <EditIcon className="size-4" />
      </button>
      <Dialog title="현금 기록 수정" open={open} onClose={() => setOpen(false)}>
        <CashForm accounts={accounts} initial={flow} onDone={() => setOpen(false)} />
      </Dialog>
    </>
  );
}

export function DeleteCashButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      className="rounded-md p-1.5 text-muted hover:bg-up/10 hover:text-up disabled:opacity-40"
      aria-label="삭제"
      disabled={pending}
      onClick={() => {
        if (!confirm("이 현금 기록을 삭제할까요?")) return;
        start(async () => {
          const res = await deleteCashFlow(id);
          if (res.error) alert(res.error);
          else router.refresh();
        });
      }}
    >
      <TrashIcon className="size-4" />
    </button>
  );
}
