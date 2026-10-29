// 실현손익 내역(매도 한 건마다의 확정 손익)과 배당금. 평균단가법은 portfolio.ts의 computePositions와 같다.
import { currencyOf, sortTrades, type Market, type Trade } from "./portfolio";

export interface Dividend {
  id: string;
  accountId: string;
  symbol: string;
  name: string;
  market: Market;
  /** 세전 금액 (현지 통화) */
  amount: number;
  /** 원천징수 세금 (현지 통화) */
  tax: number;
  /** 1 USD 당 KRW. KRW 종목은 1 */
  fxRate: number;
  /** YYYY-MM-DD */
  payDate: string;
  createdAt?: string;
  memo?: string | null;
}

/** 세후 배당금 (원화) */
export const dividendNetKrw = (d: Dividend) => (d.amount - d.tax) * (currencyOf(d.market) === "USD" ? d.fxRate : 1);

/** 매도 한 건의 확정 손익 */
export interface RealizedEvent {
  tradeId: string;
  accountId: string;
  symbol: string;
  name: string;
  market: Market;
  currency: "KRW" | "USD";
  date: string;
  quantity: number;
  /** 매도 단가 (현지 통화) */
  price: number;
  /** 평균단가 (현지 통화, 표시용 — 매수 수수료·세금 제외) */
  avgCost: number;
  /** 평균단가 (원화, 매수일 환율, 수수료·세금 제외) */
  avgCostKrw: number;
  /** 매도 대금 − 수수료 − 세금 (현지 통화) */
  proceeds: number;
  /** 판 수량의 매입금액 (현지 통화) */
  cost: number;
  pnl: number;
  /** 원화 손익: 매도 대금은 매도일 환율, 매입금액은 매수일 환율 */
  pnlKrw: number;
  proceedsKrw: number;
  costKrw: number;
  /** 원화 손익 중 환차손익 (해외만): 매입금액 × 매도일 환율 − 매수일 환율 기준 매입금액 */
  fxPnlKrw: number;
  /** 평균 매수환율 (해외만, 국내는 0) */
  avgBuyFx: number;
  /** 매도일 환율 (국내 종목은 1) */
  fxRate: number;
  /** 손익 ÷ 매입금액 (원화 기준) */
  returnRate: number;
}

/** 모든 매도를 시간순으로 따라가며 건별 실현손익을 낸다. 보유 수량을 넘는 매도는 보유분만 계산한다 */
export function realizedEvents(trades: Trade[]): RealizedEvent[] {
  const held = new Map<string, { qty: number; cost: number; costKrw: number; gross: number; grossKrw: number }>();
  const events: RealizedEvent[] = [];
  for (const t of sortTrades(trades)) {
    const k = `${t.accountId}|${t.symbol}`;
    const h = held.get(k) ?? { qty: 0, cost: 0, costKrw: 0, gross: 0, grossKrw: 0 };
    held.set(k, h);
    const currency = currencyOf(t.market);
    const fx = currency === "USD" ? t.fxRate : 1;
    if (t.type === "BUY") {
      const cost = t.quantity * t.price + t.fee + t.tax;
      h.qty += t.quantity;
      h.cost += cost;
      h.costKrw += cost * fx;
      h.gross += t.quantity * t.price;
      h.grossKrw += t.quantity * t.price * fx;
      continue;
    }
    const qty = Math.min(t.quantity, h.qty);
    if (qty <= 0) continue;
    const ratio = qty / h.qty;
    const cost = h.cost * ratio;
    const costKrw = h.costKrw * ratio;
    const gross = h.gross * ratio;
    const grossKrw = h.grossKrw * ratio;
    const proceeds = qty * t.price - t.fee - t.tax;
    const proceedsKrw = proceeds * fx;
    events.push({
      tradeId: t.id,
      accountId: t.accountId,
      symbol: t.symbol,
      name: t.name,
      market: t.market,
      currency,
      date: t.tradeDate,
      quantity: qty,
      price: t.price,
      avgCost: gross / qty,
      avgCostKrw: grossKrw / qty,
      proceeds,
      cost,
      pnl: proceeds - cost,
      pnlKrw: proceedsKrw - costKrw,
      proceedsKrw,
      costKrw,
      fxPnlKrw: currency === "USD" ? cost * fx - costKrw : 0,
      avgBuyFx: currency === "USD" && cost > 0 ? costKrw / cost : 0,
      fxRate: fx,
      returnRate: costKrw > 0 ? (proceedsKrw - costKrw) / costKrw : 0,
    });
    h.qty -= qty;
    h.cost -= cost;
    h.costKrw -= costKrw;
    h.gross -= gross;
    h.grossKrw -= grossKrw;
    if (h.qty < 1e-9) Object.assign(h, { qty: 0, cost: 0, costKrw: 0, gross: 0, grossKrw: 0 });
  }
  return events;
}

/** 연도별 실현손익·배당 합계 (최근 연도가 위) */
export function incomeByYear(events: RealizedEvent[], dividends: Dividend[]) {
  const years = new Map<string, { year: string; realizedKrw: number; dividendKrw: number; sells: number }>();
  const row = (y: string) => {
    if (!years.has(y)) years.set(y, { year: y, realizedKrw: 0, dividendKrw: 0, sells: 0 });
    return years.get(y)!;
  };
  for (const e of events) {
    const r = row(e.date.slice(0, 4));
    r.realizedKrw += e.pnlKrw;
    r.sells += 1;
  }
  for (const d of dividends) row(d.payDate.slice(0, 4)).dividendKrw += dividendNetKrw(d);
  return [...years.values()].sort((a, b) => b.year.localeCompare(a.year));
}
