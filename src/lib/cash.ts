// 계좌 현금(원화·달러) 잔고. 입금·출금·환전 기록으로 계산하고,
// '자동 반영'(linked)이면 매수·매도·배당도 현금에 반영한다.
//  - 국내 주식: 원화에서 사고 원화로 받는다
//  - 미국 주식: 달러가 있으면 달러에서 먼저 빼고, 모자라면 그날 환율로 원화에서 뺀다(통합증거금처럼).
//    판 돈과 배당은 달러로 들어온다
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
  if (t.type === "SELL") {
    b.usd += gross - t.fee - t.tax;
    return;
  }
  const cost = gross + t.fee + t.tax;
  const fromUsd = Math.min(Math.max(b.usd, 0), cost);
  b.usd -= fromUsd;
  b.krw -= (cost - fromUsd) * t.fxRate;
}

type Event = { date: string; order: number; created: string; run: (b: CashBalance) => void; accountId: string };

function events(flows: CashFlow[], trades: Trade[], dividends: Dividend[], mode: CashMode): Event[] {
  const ev: Event[] = flows.map((f) => ({ date: f.date, order: 0, created: f.createdAt ?? "", accountId: f.accountId, run: (b) => applyCash(b, f) }));
  if (mode === "linked") {
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
export function cashBalances(flows: CashFlow[], trades: Trade[], dividends: Dividend[], mode: CashMode): Map<string, CashBalance> {
  const out = new Map<string, CashBalance>();
  for (const e of events(flows, trades, dividends, mode)) {
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
export function cashTimeline(flows: CashFlow[], trades: Trade[], dividends: Dividend[], mode: CashMode) {
  const b = { krw: 0, usd: 0 };
  const out: { date: string; krw: number; usd: number }[] = [];
  for (const e of events(flows, trades, dividends, mode)) {
    e.run(b);
    if (out.at(-1)?.date === e.date) Object.assign(out.at(-1)!, b);
    else out.push({ date: e.date, ...b });
  }
  return out;
}

/** 현금이 있는지(기록이 있거나 자동 반영 중) — 화면에 현금을 보여 줄지 */
export const hasCash = (c: CashBalance) => Math.abs(c.krw) >= 1 || Math.abs(c.usd) >= 0.01;
export const cashKrw = (c: CashBalance, usdKrw: number) => c.krw + c.usd * usdKrw;
