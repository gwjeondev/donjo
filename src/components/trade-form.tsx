"use client";

import { useEffect, useRef, useState } from "react";
import { useFormAction } from "@/lib/hooks/use-form-action";
import { saveTransaction } from "@/app/actions";
import { fmtPrice, MARKET_LABEL } from "@/lib/format";
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
  preset,
  onDone,
}: {
  accounts: AccountOption[];
  defaultAccountId?: string;
  initial?: Trade & { memo?: string | null };
  /** 새 기록의 종목을 미리 채운다 (종목 상세 화면에서 추가할 때) */
  preset?: StockPreset;
  onDone: () => void;
}) {
  const { state, pending, onSubmit } = useFormAction(saveTransaction);
  const [type, setType] = useState(initial?.type ?? "BUY");
  const stock = initial ?? preset;
  /** 종목이 정해져 있어 바꿀 수 없음 (기존 기록 수정, 종목 상세에서 추가) */
  const locked = !!stock;
  const [market, setMarket] = useState<Market | null>(stock?.market ?? null);
  /** 검색에서 종목을 골랐는지 */
  const [chosen, setChosen] = useState(false);
  /** 검색 대신 직접 입력 */
  const [manual, setManual] = useState(false);
  const [lookupState, setLookupState] = useState<"idle" | "loading" | "done" | "failed">("idle");
  const [localError, setLocalError] = useState("");
  const [symbol, setSymbol] = useState(stock?.symbol.replace(/\.(KS|KQ)$/, "") ?? "");
  const [name, setName] = useState(stock?.name ?? "");
  const [date, setDate] = useState(initial?.tradeDate ?? today());
  const [fxRate, setFxRate] = useState(initial && initial.market === "US" ? String(initial.fxRate) : "");
  const fxTouched = useRef(!!initial);
  const [amounts, setAmounts] = useState({
    quantity: initial ? String(initial.quantity) : "",
    price: initial ? String(initial.price) : "",
    fee: initial?.fee ? String(initial.fee) : "",
    tax: initial?.tax ? String(initial.tax) : "",
  });
  const setAmount = (k: keyof typeof amounts) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setAmounts((a) => ({ ...a, [k]: e.target.value }));
  const [priceLoading, setPriceLoading] = useState(false);
  const [priceError, setPriceError] = useState("");

  const fillCurrentPrice = async () => {
    setPriceLoading(true);
    setPriceError("");
    try {
      const res = await fetch(`/api/quote?symbol=${encodeURIComponent(symbol)}&market=${market}`);
      const j = await res.json();
      if (!res.ok || typeof j.price !== "number") throw new Error();
      setAmounts((a) => ({ ...a, price: String(j.price) }));
    } catch {
      setPriceError("현재가를 가져오지 못했습니다");
    } finally {
      setPriceLoading(false);
    }
  };

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

  // 직접 입력: 종목코드/티커로 시장과 이름을 자동으로 찾는다
  useEffect(() => {
    if (!manual) return;
    const code = symbol.trim().toUpperCase();
    if (!code) {
      setMarket(null);
      setLookupState("idle");
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLookupState("loading");
      try {
        const res = await fetch(`/api/lookup?code=${encodeURIComponent(code)}`, { signal: ctrl.signal });
        const j = (await res.json()) as { market?: Market | null; name?: string | null };
        setMarket(j.market ?? null);
        if (j.name) setName((n) => n || j.name!);
        setLookupState(j.market ? "done" : "failed");
      } catch {
        if (!ctrl.signal.aborted) {
          setMarket(null);
          setLookupState("failed");
        }
      }
    }, 400);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [manual, symbol]);

  const resetStock = () => {
    setChosen(false);
    setManual(false);
    setMarket(null);
    setSymbol("");
    setName("");
    setLookupState("idle");
  };

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
  const totalMarket: Market = market ?? "KOSPI";

  return (
    <form
      method="post"
      onSubmit={(e) => {
        if (!market || !symbol.trim() || !name.trim()) {
          e.preventDefault();
          setLocalError(
            !symbol.trim()
              ? "종목을 검색해서 선택하세요"
              : !market
                ? "시장을 확인할 수 없습니다. 코스피/코스닥을 선택하세요"
                : "종목명을 입력하세요",
          );
          return;
        }
        setLocalError("");
        onSubmit(e);
      }}
      className="space-y-4"
    >
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
        <label className="label" htmlFor="accountId">
          계좌
        </label>
        <select
          id="accountId"
          name="accountId"
          className="input"
          defaultValue={initial?.accountId ?? defaultAccountId ?? accounts[0]?.id}
        >
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>

      {/* 종목: 선택된 종목은 카드로, 아니면 검색(또는 직접 입력). 시장은 자동으로 정해진다 */}
      <input type="hidden" name="market" value={market ?? ""} />
      {locked || chosen ? (
        <div>
          <span className="label">종목</span>
          <input type="hidden" name="symbol" value={symbol} />
          <input type="hidden" name="name" value={name} />
          <div className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface-2 px-3 py-2.5">
            <div className="min-w-0">
              <div className="truncate font-medium" title={name}>
                {name}
              </div>
              <div className="text-xs text-muted">
                {market ? MARKET_LABEL[market] : ""} · {symbol}
              </div>
            </div>
            {!locked && (
              <button type="button" onClick={resetStock} className="shrink-0 text-xs font-medium text-brand">
                변경
              </button>
            )}
          </div>
        </div>
      ) : !manual ? (
        <div className="relative">
          <label className="label" htmlFor="search">
            종목 검색
          </label>
          <input
            id="search"
            className="input"
            placeholder="종목명·종목코드·티커 (예: 삼성전자, 005930, AAPL)"
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
                      setChosen(true);
                    }}
                  >
                    <span className="truncate">{r.name}</span>
                    <span className="shrink-0 text-xs text-muted">
                      {MARKET_LABEL[r.market]} · {r.symbol.replace(/\.(KS|KQ)$/, "")}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button type="button" onClick={() => setManual(true)} className="mt-1.5 text-xs font-medium text-brand">
            검색되지 않나요? 직접 입력
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3">
            <div>
              <label className="label" htmlFor="symbol">
                종목코드·티커
              </label>
              <input
                id="symbol"
                name="symbol"
                className="input uppercase"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                placeholder="005930, AAPL"
                autoComplete="off"
              />
            </div>
            <div>
              <label className="label" htmlFor="name">
                종목명
              </label>
              <input
                id="name"
                name="name"
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="삼성전자"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-muted">
              {lookupState === "loading"
                ? "시장 확인 중…"
                : market
                  ? `${MARKET_LABEL[market]} 종목으로 인식했어요`
                  : lookupState === "failed"
                    ? "시장을 확인하지 못했어요. 선택해 주세요"
                    : "코드를 입력하면 시장을 자동으로 찾아요"}
            </span>
            {lookupState === "failed" && /^[0-9]/.test(symbol) && (
              <div className="flex rounded-lg bg-surface-2 p-0.5">
                {(["KOSPI", "KOSDAQ"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMarket(m)}
                    className={`rounded-md px-2.5 py-1 font-medium ${market === m ? "bg-surface text-ink shadow-sm" : "text-ink-2"}`}
                  >
                    {MARKET_LABEL[m]}
                  </button>
                ))}
              </div>
            )}
            <button type="button" onClick={resetStock} className="font-medium text-brand">
              검색으로 돌아가기
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="tradeDate">
            거래일
          </label>
          <input
            id="tradeDate"
            name="tradeDate"
            type="date"
            className="input"
            required
            value={date}
            max={today()}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="quantity">
            수량 (주)
          </label>
          <input
            id="quantity"
            name="quantity"
            inputMode="decimal"
            className="input text-right"
            required
            value={amounts.quantity}
            onChange={setAmount("quantity")}
          />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <label className="label" htmlFor="price">
              단가 ({currency})
            </label>
            <button
              type="button"
              onClick={fillCurrentPrice}
              disabled={!symbol.trim() || !market || priceLoading}
              className="mb-1 text-xs font-medium text-brand disabled:text-muted"
            >
              {priceLoading ? "조회 중…" : "현재가"}
            </button>
          </div>
          <input
            id="price"
            name="price"
            inputMode="decimal"
            className="input text-right"
            required
            value={amounts.price}
            onChange={setAmount("price")}
          />
          {priceError && <p className="mt-1 text-xs text-up">{priceError}</p>}
        </div>
        {market === "US" ? (
          <div>
            <label className="label" htmlFor="fxRate">
              환율 (원/USD)
            </label>
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
          <label className="label" htmlFor="fee">
            수수료 ({currency})
          </label>
          <input
            id="fee"
            name="fee"
            inputMode="decimal"
            className="input text-right"
            value={amounts.fee}
            onChange={setAmount("fee")}
            placeholder="0"
          />
        </div>
        <div>
          <label className="label" htmlFor="tax">
            세금 ({currency})
          </label>
          <input
            id="tax"
            name="tax"
            inputMode="decimal"
            className="input text-right"
            value={amounts.tax}
            onChange={setAmount("tax")}
            placeholder="0"
          />
        </div>
      </div>

      <div>
        <label className="label" htmlFor="memo">
          메모
        </label>
        <input id="memo" name="memo" className="input" defaultValue={initial?.memo ?? ""} placeholder="매매 이유 등" />
      </div>

      <TradeTotal type={type} market={totalMarket} fxRate={fxRate} {...amounts} />

      {(localError || state.error) && <p className="text-sm text-up">{localError || state.error}</p>}
      <button className="btn-primary w-full py-2.5" disabled={pending || accounts.length === 0}>
        {pending ? "저장 중…" : initial ? "수정하기" : type === "BUY" ? "매수 기록 추가" : "매도 기록 추가"}
      </button>
    </form>
  );
}

/** 입력 중 실수로 닫히지 않도록 X 버튼으로만 닫는다 (바깥 클릭·Esc 무시) */
const toNum = (v: string) => Number(v.replaceAll(",", "")) || 0;

/** 입력 중인 거래의 총액 미리보기 (매수: 금액+비용, 매도: 금액-비용 = 받을 돈) */
function TradeTotal(props: {
  type: "BUY" | "SELL";
  market: Market;
  fxRate: string;
  quantity: string;
  price: string;
  fee: string;
  tax: string;
}) {
  const gross = toNum(props.quantity) * toNum(props.price);
  if (!gross) return null;
  const cost = toNum(props.fee) + toNum(props.tax);
  const net = props.type === "BUY" ? gross + cost : gross - cost;
  const currency = props.market === "US" ? "USD" : "KRW";
  const fx = toNum(props.fxRate);
  return (
    <div className="flex items-baseline justify-between gap-3 rounded-lg bg-surface-2 px-3 py-2.5 text-sm">
      <span className="text-ink-2">{props.type === "BUY" ? "총 매수금액" : "받을 금액"}</span>
      <span className="text-right">
        <span className="font-semibold">{fmtPrice(net, currency)}</span>
        {currency === "USD" && fx > 0 && (
          <span className="ml-1.5 text-xs text-muted">≈ {fmtPrice(net * fx, "KRW")}</span>
        )}
      </span>
    </div>
  );
}

const DIALOG_EXIT_MS = 250;

/** 입력 중 실수로 닫히지 않도록 X 버튼으로만 닫는다 (바깥 클릭·Esc 무시). 닫힐 때는 퇴장 애니메이션 후 제거 */
export function Dialog({
  title,
  open,
  onClose,
  children,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      setClosing(false);
      return;
    }
    if (!mounted) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setClosing(true);
    const t = window.setTimeout(
      () => {
        setMounted(false);
        setClosing(false);
      },
      reduce ? 0 : DIALOG_EXIT_MS,
    );
    return () => window.clearTimeout(t);
  }, [open, mounted]);

  if (!mounted) return null;
  return (
    <div
      data-closing={closing || undefined}
      className="dialog-backdrop fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
    >
      <div
        role="dialog"
        aria-modal
        aria-label={title}
        data-closing={closing || undefined}
        className="dialog-panel max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl bg-surface p-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] sm:max-w-md sm:rounded-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="p-1 text-ink-2" aria-label="닫기" disabled={closing}>
            <CloseIcon />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export interface StockPreset {
  symbol: string;
  name: string;
  market: Market;
}

export function AddTradeButton({
  accounts,
  defaultAccountId,
  preset,
  label = "매매 기록",
}: {
  accounts: AccountOption[];
  defaultAccountId?: string;
  preset?: StockPreset;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn-primary" onClick={() => setOpen(true)} disabled={accounts.length === 0}>
        <PlusIcon className="size-4" /> {label}
      </button>
      <Dialog title="매매 기록 추가" open={open} onClose={() => setOpen(false)}>
        <TradeForm
          accounts={accounts}
          defaultAccountId={defaultAccountId}
          preset={preset}
          onDone={() => setOpen(false)}
        />
      </Dialog>
    </>
  );
}

export function EditTradeButton({
  accounts,
  trade,
}: {
  accounts: AccountOption[];
  trade: Trade & { memo?: string | null };
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        className="rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-ink"
        onClick={() => setOpen(true)}
        aria-label="수정"
      >
        <EditIcon className="size-4" />
      </button>
      <Dialog title="매매 기록 수정" open={open} onClose={() => setOpen(false)}>
        <TradeForm accounts={accounts} initial={trade} onDone={() => setOpen(false)} />
      </Dialog>
    </>
  );
}
