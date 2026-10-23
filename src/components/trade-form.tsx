"use client";

import { useEffect, useRef, useState } from "react";
import { useFormAction } from "@/lib/hooks/use-form-action";
import { saveTransaction } from "@/app/actions";
import { MARKET_LABEL } from "@/lib/format";
import type { Market, Trade } from "@/lib/portfolio";
import { CloseIcon, EditIcon, PlusIcon } from "./icons";

interface AccountOption {
  id: string;
  name: string;
}

interface SearchResult {
  symbol: string;
  name: string;
  market: Market;
}

const today = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

function TradeForm({
  accounts,
  defaultAccountId,
  initial,
  onDone,
}: {
  accounts: AccountOption[];
  defaultAccountId?: string;
  initial?: Trade & { memo?: string | null };
  onDone: () => void;
}) {
  const { state, pending, onSubmit } = useFormAction(saveTransaction);
  const [type, setType] = useState(initial?.type ?? "BUY");
  const [market, setMarket] = useState<Market>(initial?.market ?? "KOSPI");
  const [symbol, setSymbol] = useState(initial?.symbol.replace(/\.(KS|KQ)$/, "") ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [date, setDate] = useState(initial?.tradeDate ?? today());
  const [fxRate, setFxRate] = useState(initial && initial.market === "US" ? String(initial.fxRate) : "");
  const fxTouched = useRef(!!initial);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (state.ok) onDone();
  }, [state, onDone]);

  // 종목 검색 (디바운스)
  useEffect(() => {
    const q = query.trim();
    if (!q) return setResults([]);
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        setResults((await res.json()).results ?? []);
      } catch {
        /* 취소되었거나 실패: 직접 입력 가능 */
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query]);

  // 미국 주식은 거래일 환율을 자동으로 채운다 (직접 수정하면 유지)
  useEffect(() => {
    if (market !== "US" || fxTouched.current) return;
    const ctrl = new AbortController();
    fetch(`/api/fx?date=${date}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((j) => j.rate && !fxTouched.current && setFxRate(String(Math.round(j.rate * 100) / 100)))
      .catch(() => {});
    return () => ctrl.abort();
  }, [market, date]);

  const currency = market === "US" ? "USD" : "원";

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <input type="hidden" name="type" value={type} />

      <div className="grid grid-cols-2 gap-1 rounded-lg bg-surface-2 p-1">
        {(["BUY", "SELL"] as const).map((t) => (
          <button
            type="button"
            key={t}
            onClick={() => setType(t)}
            className={`rounded-md py-2 text-sm font-semibold transition ${
              type === t ? (t === "BUY" ? "bg-up text-white" : "bg-down text-white") : "text-ink-2"
            }`}
          >
            {t === "BUY" ? "매수" : "매도"}
          </button>
        ))}
      </div>

      <div>
        <label className="label" htmlFor="accountId">계좌</label>
        <select id="accountId" name="accountId" className="input" defaultValue={initial?.accountId ?? defaultAccountId ?? accounts[0]?.id}>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
      </div>

      {!initial && (
        <div className="relative">
          <label className="label" htmlFor="search">종목 검색</label>
          <input
            id="search"
            className="input"
            placeholder="종목코드·티커·영문명 (예: 005930, AAPL, Samsung)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
          />
          {query && (results.length > 0 || searching) && (
            <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-line bg-surface shadow-lg">
              {searching && results.length === 0 && <li className="px-3 py-2 text-sm text-muted">검색 중…</li>}
              {results.map((r) => (
                <li key={r.symbol}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-surface-2"
                    onClick={() => {
                      setMarket(r.market);
                      setSymbol(r.symbol.replace(/\.(KS|KQ)$/, ""));
                      setName(r.name);
                      setQuery("");
                    }}
                  >
                    <span className="truncate">{r.name}</span>
                    <span className="shrink-0 text-xs text-muted">{MARKET_LABEL[r.market]} · {r.symbol}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-1 text-xs text-muted">검색되지 않으면 아래에 직접 입력하세요.</p>
        </div>
      )}

      <div className="grid grid-cols-[110px_1fr] gap-3">
        <div>
          <label className="label" htmlFor="market">시장</label>
          <select id="market" name="market" className="input" value={market} onChange={(e) => setMarket(e.target.value as Market)}>
            {(Object.keys(MARKET_LABEL) as Market[]).map((m) => (
              <option key={m} value={m}>{MARKET_LABEL[m]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="symbol">{market === "US" ? "티커" : "종목코드"}</label>
          <input
            id="symbol"
            name="symbol"
            className="input uppercase"
            required
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            placeholder={market === "US" ? "AAPL" : "005930"}
          />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="name">종목명</label>
        <input id="name" name="name" className="input" required value={name} onChange={(e) => setName(e.target.value)} placeholder="삼성전자" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="tradeDate">거래일</label>
          <input id="tradeDate" name="tradeDate" type="date" className="input" required value={date} max={today()} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="quantity">수량 (주)</label>
          <input id="quantity" name="quantity" inputMode="decimal" className="input text-right" required defaultValue={initial?.quantity} />
        </div>
        <div>
          <label className="label" htmlFor="price">단가 ({currency})</label>
          <input id="price" name="price" inputMode="decimal" className="input text-right" required defaultValue={initial?.price} />
        </div>
        {market === "US" ? (
          <div>
            <label className="label" htmlFor="fxRate">환율 (원/USD)</label>
            <input
              id="fxRate"
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
          <label className="label" htmlFor="fee">수수료 ({currency})</label>
          <input id="fee" name="fee" inputMode="decimal" className="input text-right" defaultValue={initial?.fee || ""} placeholder="0" />
        </div>
        <div>
          <label className="label" htmlFor="tax">세금 ({currency})</label>
          <input id="tax" name="tax" inputMode="decimal" className="input text-right" defaultValue={initial?.tax || ""} placeholder="0" />
        </div>
      </div>

      <div>
        <label className="label" htmlFor="memo">메모</label>
        <input id="memo" name="memo" className="input" defaultValue={initial?.memo ?? ""} placeholder="매매 이유 등" />
      </div>

      {state.error && <p className="text-sm text-up">{state.error}</p>}
      <button className="btn-primary w-full py-2.5" disabled={pending || accounts.length === 0}>
        {pending ? "저장 중…" : initial ? "수정하기" : type === "BUY" ? "매수 기록 추가" : "매도 기록 추가"}
      </button>
    </form>
  );
}

/** 입력 중 실수로 닫히지 않도록 X 버튼으로만 닫는다 (바깥 클릭·Esc 무시) */
export function Dialog({ title, open, onClose, children }: { title: string; open: boolean; onClose: () => void; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal
        aria-label={title}
        className="max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl bg-surface p-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] sm:max-w-md sm:rounded-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="p-1 text-ink-2" aria-label="닫기"><CloseIcon /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function AddTradeButton({ accounts, defaultAccountId, label = "매매 기록" }: { accounts: AccountOption[]; defaultAccountId?: string; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn-primary" onClick={() => setOpen(true)} disabled={accounts.length === 0}>
        <PlusIcon className="size-4" /> {label}
      </button>
      <Dialog title="매매 기록 추가" open={open} onClose={() => setOpen(false)}>
        <TradeForm accounts={accounts} defaultAccountId={defaultAccountId} onDone={() => setOpen(false)} />
      </Dialog>
    </>
  );
}

export function EditTradeButton({ accounts, trade }: { accounts: AccountOption[]; trade: Trade & { memo?: string | null } }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-ink" onClick={() => setOpen(true)} aria-label="수정">
        <EditIcon className="size-4" />
      </button>
      <Dialog title="매매 기록 수정" open={open} onClose={() => setOpen(false)}>
        <TradeForm accounts={accounts} initial={trade} onDone={() => setOpen(false)} />
      </Dialog>
    </>
  );
}
