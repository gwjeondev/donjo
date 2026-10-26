// 계좌 현금(원화·달러) 잔고. 입금·출금·환전 기록으로 계산하고,
// '매매와 연동'(linked)이면 연동을 켠 뒤에 기록한 매수·매도·배당도 현금에 반영한다.
//  - 국내 주식: 원화에서 사고 원화로 받는다
//  - 미국 주식: 달러로만 사고 달러로 받는다 (달러는 입금·환전으로 직접 넣는다. 모자라면 달러가 마이너스)
import { currencyOf, sortTrades, type Trade } from "./portfolio";
import type { Dividend } from "./income";

export type CashType = "DEPOSIT" | "WITHDRAW" | "EXCHANGE";
export type CashMode = "manual" | "linked";

export interface CashFlow {
  id: string;
  accountId: string;
  type: CashType;
  /** 입출금 통화, 환전이면 보낸 통화 */
  currency: "KRW" | "USD";
  amount: number;
  /** 1 USD 당 KRW (원화 입출금은 1) */
  fxRate: number;
  /** YYYY-MM-DD */
  date: string;
  createdAt?: string;
  memo?: string | null;
}

export interface CashBalance {
  krw: number;
  usd: number;
}

export const CASH_LABEL: Record<CashType, string> = { DEPOSIT: "입금", WITHDRAW: "출금", EXCHANGE: "환전" };

/** 현금 기록 한 건이 잔고를 어떻게 바꾸는지 */
export function applyCash(b: CashBalance, f: CashFlow) {
  const usd = f.currency === "USD";
  const sign = f.type === "DEPOSIT" ? 1 : -1;
  if (f.type !== "EXCHANGE") {
    if (usd) b.usd += sign * f.amount;
    else b.krw += sign * f.amount;
  } else if (usd) {
    b.usd -= f.amount;
    b.krw += f.amount * f.fxRate;
  } else {
    b.krw -= f.amount;
    b.usd += f.amount / f.fxRate;
  }
}

function applyTrade(b: CashBalance, t: Trade) {
  const gross = t.quantity * t.price;
  if (currencyOf(t.market) === "KRW") {
    b.krw += t.type === "BUY" ? -(gross + t.fee + t.tax) : gross - t.fee - t.tax;
    return;
  }
  b.usd += t.type === "BUY" ? -(gross + t.fee + t.tax) : gross - t.fee - t.tax;
}

type Event = { date: string; order: number; created: string; run: (b: CashBalance) => void; accountId: string };

function events(flows: CashFlow[], allTrades: Trade[], allDividends: Dividend[], mode: CashMode, since?: string): Event[] {
  const ev: Event[] = flows.map((f) => ({ date: f.date, order: 0, created: f.createdAt ?? "", accountId: f.accountId, run: (b) => applyCash(b, f) }));
  if (mode === "linked") {
    // 연동을 켠 뒤에 기록한 것만 (이미 있던 기록은 현금을 바꾸지 않는다)
    const after = (created?: string) => !since || (created ?? "") >= since;
    const trades = allTrades.filter((t) => after(t.createdAt));
    // 자동 배당은 앱이 나중에 만들기도 하므로 기록 시각이 아니라 지급일로 본다
    const dividends = allDividends.filter((d) => (d.auto ? !since || d.payDate >= since.slice(0, 10) : after(d.createdAt)));
    // 같은 날에는 입출금 → 매매 → 배당 순서
    sortTrades(trades).forEach((t, i) =>
      ev.push({ date: t.tradeDate, order: 1, created: String(i).padStart(8, "0"), accountId: t.accountId, run: (b) => applyTrade(b, t) }),
    );
    for (const d of dividends) {
      const net = d.amount - d.tax;
      ev.push({
        date: d.payDate,
        order: 2,
        created: "",
        accountId: d.accountId,
        run: (b) => (currencyOf(d.market) === "USD" ? (b.usd += net) : (b.krw += net)),
      });
    }
  }
  return ev.sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order || a.created.localeCompare(b.created));
}

/** 계좌별 현재 현금 잔고 */
export function cashBalances(flows: CashFlow[], trades: Trade[], dividends: Dividend[], mode: CashMode, since?: string): Map<string, CashBalance> {
  const out = new Map<string, CashBalance>();
  for (const e of events(flows, trades, dividends, mode, since)) {
    if (!out.has(e.accountId)) out.set(e.accountId, { krw: 0, usd: 0 });
    e.run(out.get(e.accountId)!);
  }
  return out;
}

/** 모든 계좌 합계 */
export function totalCash(balances: Map<string, CashBalance>): CashBalance {
  const t = { krw: 0, usd: 0 };
  for (const b of balances.values()) {
    t.krw += b.krw;
    t.usd += b.usd;
  }
  return t;
}

/** 날짜별 현금 잔고(모든 계좌 합) — 그 날짜가 끝난 뒤의 잔고. 자산 추이용 */
export function cashTimeline(flows: CashFlow[], trades: Trade[], dividends: Dividend[], mode: CashMode, since?: string) {
  const b = { krw: 0, usd: 0 };
  const out: { date: string; krw: number; usd: number }[] = [];
  for (const e of events(flows, trades, dividends, mode, since)) {
    e.run(b);
    if (out.at(-1)?.date === e.date) Object.assign(out.at(-1)!, b);
    else out.push({ date: e.date, ...b });
  }
  return out;
}

/** 현금이 있는지(기록이 있거나 자동 반영 중) — 화면에 현금을 보여 줄지 */
export const hasCash = (c: CashBalance) => Math.abs(c.krw) >= 1 || Math.abs(c.usd) >= 0.01;
export const cashKrw = (c: CashBalance, usdKrw: number) => c.krw + c.usd * usdKrw;
