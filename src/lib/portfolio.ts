// 매수/매도 기록으로부터 보유 현황과 수익을 계산하는 순수 함수 모음.
// 평균단가법(이동평균) 기준이며, 원화 환산 금액은 거래 시점 환율을 사용한다.

export type Market = "KOSPI" | "KOSDAQ" | "US";
export type TradeType = "BUY" | "SELL";

export interface Trade {
  id: string;
  accountId: string;
  symbol: string;
  name: string;
  market: Market;
  type: TradeType;
  quantity: number;
  price: number;
  fee: number;
  tax: number;
  /** 1 USD 당 KRW. KRW 종목은 1 */
  fxRate: number;
  /** YYYY-MM-DD */
  tradeDate: string;
  createdAt?: string;
  memo?: string | null;
}

export interface Position {
  accountId: string;
  symbol: string;
  name: string;
  market: Market;
  currency: "KRW" | "USD";
  quantity: number;
  /** 현지 통화 기준 평균단가 (표시용, 수수료·세금 제외 — 증권사 평단과 같다) */
  avgCost: number;
  /** 수수료·세금을 뺀 매수 대금 (평균단가 계산용, 현지 통화) */
  grossCost: number;
  /** 수수료·세금을 뺀 매수 대금 (원화, 매수 시점 환율) */
  grossCostKrw: number;
  /** 현지 통화 기준 매입금액 */
  costBasis: number;
  /** 원화 기준 매입금액 (매수 시점 환율) */
  costBasisKrw: number;
  /** 원화 기준 실현손익 (매도 시점 환율) */
  realizedPnlKrw: number;
  /** 현지 통화 기준 실현손익 */
  realizedPnl: number;
}

export const currencyOf = (market: Market): "KRW" | "USD" =>
  market === "US" ? "USD" : "KRW";

export function sortTrades<T extends Trade>(trades: T[]): T[] {
  return [...trades].sort(
    (a, b) =>
      a.tradeDate.localeCompare(b.tradeDate) ||
      (a.createdAt ?? "").localeCompare(b.createdAt ?? "") ||
      a.id.localeCompare(b.id),
  );
}

const key = (t: { accountId: string; symbol: string }) =>
  `${t.accountId}|${t.symbol}`;

/** 계좌·종목별 포지션 계산. 수량이 0이 된 종목도 실현손익 확인을 위해 남겨 둔다. */
export function computePositions(trades: Trade[]): Position[] {
  const map = new Map<string, Position>();
  for (const t of sortTrades(trades)) {
    let p = map.get(key(t));
    if (!p) {
      p = {
        accountId: t.accountId,
        symbol: t.symbol,
        name: t.name,
        market: t.market,
        currency: currencyOf(t.market),
        quantity: 0,
        avgCost: 0,
        grossCost: 0,
        grossCostKrw: 0,
        costBasis: 0,
        costBasisKrw: 0,
        realizedPnlKrw: 0,
        realizedPnl: 0,
      };
      map.set(key(t), p);
    }
    p.name = t.name;
    const fx = p.currency === "USD" ? t.fxRate : 1;
    if (t.type === "BUY") {
      const cost = t.quantity * t.price + t.fee + t.tax;
      p.quantity += t.quantity;
      p.costBasis += cost;
      p.costBasisKrw += cost * fx;
      p.grossCost += t.quantity * t.price;
      p.grossCostKrw += t.quantity * t.price * fx;
    } else {
      const qty = Math.min(t.quantity, p.quantity);
      if (qty <= 0) continue;
      const ratio = qty / p.quantity;
      const soldCost = p.costBasis * ratio;
      const soldCostKrw = p.costBasisKrw * ratio;
      const proceeds = qty * t.price - t.fee - t.tax;
      p.realizedPnl += proceeds - soldCost;
      p.realizedPnlKrw += proceeds * fx - soldCostKrw;
      p.quantity -= qty;
      p.costBasis -= soldCost;
      p.costBasisKrw -= soldCostKrw;
      p.grossCost -= p.grossCost * ratio;
      p.grossCostKrw -= p.grossCostKrw * ratio;
      if (p.quantity < 1e-9) {
        p.quantity = 0;
        p.grossCost = 0;
        p.grossCostKrw = 0;
        p.costBasis = 0;
        p.costBasisKrw = 0;
      }
    }
    p.avgCost = p.quantity > 0 ? p.grossCost / p.quantity : 0;
  }
  return [...map.values()];
}

/** 특정 시점까지의 보유 수량 (매도 초과분은 무시) */
export function quantityAt(trades: Trade[], symbol: string, date: string): number {
  return computePositions(
    trades.filter((t) => t.symbol === symbol && t.tradeDate <= date),
  ).reduce((s, p) => s + p.quantity, 0);
}

export interface ValuedPosition extends Position {
  price: number | null;
  previousClose: number | null;
  /** 원화 평가금액 (시세가 없으면 매입금액) */
  valueKrw: number;
  unrealizedPnlKrw: number;
  returnRate: number;
  dayChangeKrw: number;
  hasQuote: boolean;
}

export function valuePosition(
  p: Position,
  quote: { price: number; previousClose?: number | null } | undefined,
  usdKrw: number,
): ValuedPosition {
  const fx = p.currency === "USD" ? usdKrw : 1;
  const price = quote?.price ?? null;
  const valueKrw = price != null ? p.quantity * price * fx : p.costBasisKrw;
  const unrealizedPnlKrw = valueKrw - p.costBasisKrw;
  const prev = quote?.previousClose ?? null;
  return {
    ...p,
    price,
    previousClose: prev,
    valueKrw,
    unrealizedPnlKrw,
    returnRate: p.costBasisKrw > 0 ? unrealizedPnlKrw / p.costBasisKrw : 0,
    dayChangeKrw: price != null && prev != null ? p.quantity * (price - prev) * fx : 0,
    hasQuote: price != null,
  };
}

export interface Summary {
  valueKrw: number;
  costBasisKrw: number;
  unrealizedPnlKrw: number;
  realizedPnlKrw: number;
  totalPnlKrw: number;
  returnRate: number;
  dayChangeKrw: number;
}

export function summarize(positions: ValuedPosition[]): Summary {
  const s = positions.reduce(
    (acc, p) => {
      acc.valueKrw += p.quantity > 0 ? p.valueKrw : 0;
      acc.costBasisKrw += p.costBasisKrw;
      acc.realizedPnlKrw += p.realizedPnlKrw;
      acc.dayChangeKrw += p.dayChangeKrw;
      return acc;
    },
    { valueKrw: 0, costBasisKrw: 0, realizedPnlKrw: 0, dayChangeKrw: 0 },
  );
  const unrealizedPnlKrw = s.valueKrw - s.costBasisKrw;
  return {
    ...s,
    unrealizedPnlKrw,
    totalPnlKrw: unrealizedPnlKrw + s.realizedPnlKrw,
    returnRate: s.costBasisKrw > 0 ? unrealizedPnlKrw / s.costBasisKrw : 0,
  };
}

/**
 * 수량은 DB에 소수 6자리까지 저장된다. 증권사 화면의 소수점 주식 수량도 반올림된 값이라,
 * 매수 합계와 매도 수량이 마지막 자리(0.000001주)만큼 어긋나는 것은 전량 매도로 본다.
 */
const QTY_TOLERANCE = 1e-6 + 1e-9;

/** 보유 수량을 초과하는 매도가 있으면 그 거래와 그 직전 보유 수량을 반환 */
export function oversellAt<T extends Trade>(trades: T[]): { trade: T; held: number } | null {
  const held = new Map<string, number>();
  for (const t of sortTrades(trades)) {
    const q = held.get(key(t)) ?? 0;
    if (t.type === "BUY") held.set(key(t), q + t.quantity);
    else {
      if (t.quantity > q + QTY_TOLERANCE) return { trade: t, held: Math.max(q, 0) };
      held.set(key(t), Math.max(q - t.quantity, 0));
    }
  }
  return null;
}

export function findOversell<T extends Trade>(trades: T[]): T | null {
  return oversellAt(trades)?.trade ?? null;
}

/** 여러 계좌의 같은 종목을 하나로 합친다 (전체 자산 보기용) */
export function mergeBySymbol(positions: ValuedPosition[]): ValuedPosition[] {
  const map = new Map<string, ValuedPosition>();
  for (const p of positions) {
    const m = map.get(p.symbol);
    if (!m) {
      map.set(p.symbol, { ...p, accountId: "*" });
      continue;
    }
    m.quantity += p.quantity;
    m.costBasis += p.costBasis;
    m.costBasisKrw += p.costBasisKrw;
    m.grossCost += p.grossCost;
    m.grossCostKrw += p.grossCostKrw;
    m.realizedPnl += p.realizedPnl;
    m.realizedPnlKrw += p.realizedPnlKrw;
    m.valueKrw += p.valueKrw;
    m.unrealizedPnlKrw += p.unrealizedPnlKrw;
    m.dayChangeKrw += p.dayChangeKrw;
  }
  for (const m of map.values()) {
    m.avgCost = m.quantity > 0 ? m.grossCost / m.quantity : 0;
    m.returnRate = m.costBasisKrw > 0 ? m.unrealizedPnlKrw / m.costBasisKrw : 0;
  }
  return [...map.values()];
}

export type DisplayCurrency = "KRW" | "USD";

export interface DisplayFigures {
  currency: "KRW" | "USD";
  price: number | null;
  avgCost: number;
  value: number;
  pnl: number;
  returnRate: number;
}

/**
 * 종목별 표시용 금액. 해외 종목은 원화/달러 중 선택한 통화로, 국내 종목은 항상 원화로 보여 준다.
 * 원화: 현재가·평가금액은 현재 환율, 평균단가·매입금액은 매수 시점 환율 기준 (환차손익 포함)
 * 달러: 환율 영향을 뺀 현지 통화 기준
 */
export function displayFigures(p: ValuedPosition, mode: DisplayCurrency, usdKrw: number): DisplayFigures {
  if (p.currency === "USD" && mode === "USD") {
    const value = p.price != null ? p.quantity * p.price : p.costBasis;
    const pnl = value - p.costBasis;
    return {
      currency: "USD",
      price: p.price,
      avgCost: p.avgCost,
      value,
      pnl,
      returnRate: p.costBasis > 0 ? pnl / p.costBasis : 0,
    };
  }
  const fx = p.currency === "USD" ? usdKrw : 1;
  return {
    currency: "KRW",
    price: p.price != null ? p.price * fx : null,
    avgCost: p.quantity > 0 ? p.grossCostKrw / p.quantity : 0,
    value: p.valueKrw,
    pnl: p.unrealizedPnlKrw,
    returnRate: p.returnRate,
  };
}
