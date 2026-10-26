// 자동 배당: 배당 이력(배당락일·주당 배당금)과 매매 기록으로 계좌마다 받았을 배당을 추정한다.
//  - 보유 수량: 배당락일 전날까지의 매매로 계산 (배당락일에 산 주식은 배당이 없다)
//  - 세금: 계좌 종류와 시장으로 원천징수 추정
//  - 지급일: 배당 이력에는 배당락일만 있어서 시장·종목 종류로 추정한다 (아직 지급일이 안 됐으면 만들지 않는다)
import { currencyOf, sortTrades, type Market, type Trade } from "./portfolio";
import type { DividendEvent } from "./market/types";
import { addDays } from "./performance";

export type AccountKind = "GENERAL" | "ISA" | "PENSION";

export const ACCOUNT_KIND_LABEL: Record<AccountKind, string> = { GENERAL: "일반", ISA: "ISA", PENSION: "연금·IRP" };

export interface AutoDividend {
  accountId: string;
  symbol: string;
  name: string;
  market: Market;
  exDate: string;
  payDate: string;
  /** 세전 배당금 (현지 통화) */
  amount: number;
  tax: number;
  fxRate: number;
}

// 국내 상장 ETF 이름 (운용사 브랜드). 분배금은 배당락 며칠 뒤에 들어온다
const KR_ETF = /^(KODEX|TIGER|ACE|SOL|RISE|KBSTAR|HANARO|ARIRANG|KOSEF|TIME|PLUS|KIWOOM|1Q|BNK|WON|파워|마이다스|UNICORN|에셋플러스|TRUSTON|흥국|대신343|히어로즈|VITA|FOCUS|TREX|마이티|KoAct)\b/i;

/** 지급일 추정: 국내 ETF는 배당락 +4일, 국내 주식 결산배당(12월)은 다음 해 4월 20일, 그 밖의 국내 주식은 +30일, 미국은 +14일 */
export function estimatePayDate(market: Market, name: string, exDate: string): string {
  if (market === "US") return addDays(exDate, 14);
  if (KR_ETF.test(name.trim())) return addDays(exDate, 4);
  if (exDate.slice(5, 7) === "12") return `${Number(exDate.slice(0, 4)) + 1}-04-20`;
  return addDays(exDate, 30);
}

/**
 * 원천징수 추정
 *  - 국내 배당: 일반 계좌 15.4%(소득세 14% + 지방소득세 1.4%, 10원 미만 버림), ISA·연금은 받을 때 떼지 않음
 *  - 미국 배당: 계좌와 상관없이 미국에서 15%
 */
export function withholding(kind: AccountKind, market: Market, amount: number): number {
  if (market === "US") return Math.round(amount * 0.15 * 100) / 100;
  if (kind !== "GENERAL") return 0;
  const income = Math.floor((amount * 0.14) / 10) * 10;
  return income + Math.floor((income * 0.1) / 10) * 10;
}

export function computeAutoDividends({
  trades,
  events,
  kinds,
  fxOn,
  today,
}: {
  trades: Trade[];
  /** 심볼 → 배당 이력 */
  events: Map<string, DividendEvent[]>;
  kinds: Map<string, AccountKind>;
  /** 그 날짜(또는 그 전 가장 가까운 날)의 원달러 환율 */
  fxOn: (date: string) => number | null;
  today: string;
}): AutoDividend[] {
  // 계좌·종목별 매매 (시간순)
  const groups = new Map<string, Trade[]>();
  for (const t of sortTrades(trades)) {
    const k = `${t.accountId}|${t.symbol}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(t);
  }
  const out: AutoDividend[] = [];
  for (const list of groups.values()) {
    const { accountId, symbol, market } = list[0];
    const name = list.at(-1)!.name;
    for (const ev of events.get(symbol) ?? []) {
      if (ev.exDate <= list[0].tradeDate) continue;
      let qty = 0;
      for (const t of list) {
        if (t.tradeDate >= ev.exDate) break;
        qty += t.type === "BUY" ? t.quantity : -t.quantity;
      }
      if (qty <= 1e-9) continue;
      const payDate = estimatePayDate(market, name, ev.exDate);
      if (payDate > today) continue;
      const usd = currencyOf(market) === "USD";
      const amount = usd ? Math.round(qty * ev.amount * 100) / 100 : Math.floor(qty * ev.amount);
      if (amount <= 0) continue;
      const fxRate = usd ? fxOn(payDate) : 1;
      if (fxRate == null) continue;
      out.push({ accountId, symbol, name, market, exDate: ev.exDate, payDate, amount, tax: withholding(kinds.get(accountId) ?? "GENERAL", market, amount), fxRate });
    }
  }
  return out;
}
