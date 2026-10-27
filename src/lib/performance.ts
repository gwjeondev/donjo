// 일별 자산 시계열과 일/월/년 단위 자산 증가율 계산.
// 수익률은 매수·매도에 따른 입출금 효과를 제거한 시간가중수익률(TWR)이다.
import { currencyOf, sortTrades, type Trade } from "./portfolio";

export interface DailyPoint {
  date: string;
  /** 원화 평가금액 */
  value: number;
  /** 당일 순투입금 (매수액 - 매도대금, 원화) */
  flow: number;
  /** 당일 수익률 */
  ret: number;
}

/** symbol -> (date -> close). 환율은 "KRW=X" 키 사용 */
export type PriceSeries = Map<string, Map<string, number>>;
export const FX_SYMBOL = "KRW=X";

export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const isWeekend = (date: string) => {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
};

/** 시세가 없는 날은 직전 값을 사용하는 조회기 */
function carryForward(series: Map<string, number> | undefined) {
  const dates = series ? [...series.keys()].sort() : [];
  let i = -1;
  let last: number | undefined;
  return (date: string): number | undefined => {
    while (i + 1 < dates.length && dates[i + 1] <= date) {
      i++;
      last = series!.get(dates[i]);
    }
    return last;
  };
}

export function buildDailySeries(
  trades: Trade[],
  prices: PriceSeries,
  today: string,
  /** 날짜별 받은 배당금 (세후, 원화). 계좌 밖으로 나간 돈으로 보고 그날 손익에 더한다 */
  dividends: Map<string, number> = new Map(),
  /** 이 날짜부터만 평가금액을 계산한다 (그 전 매매는 보유 수량만 따라간다). 짧은 기간을 빨리 보여 주기 위해 */
  valuesFrom?: string,
): DailyPoint[] {
  const sorted = sortTrades(trades);
  if (sorted.length === 0) return [];

  const symbols = [...new Set(sorted.map((t) => t.symbol))];
  const lookups = new Map(symbols.map((s) => [s, carryForward(prices.get(s))]));
  const firstTrade = new Map(symbols.map((s) => [s, sorted.find((t) => t.symbol === s)!]));
  const fxLookup = carryForward(prices.get(FX_SYMBOL));

  const qty = new Map<string, number>();
  const lastTradePrice = new Map<string, number>();
  const points: DailyPoint[] = [];
  let ti = 0;
  let prevValue = 0;

  for (let date = sorted[0].tradeDate; date <= today; date = addDays(date, 1)) {
    let flow = 0;
    let bought = 0;
    let hasTrade = false;
    const dividend = dividends.get(date) ?? 0;
    if (dividend) {
      // 배당금은 매도대금처럼 인출로 본다: 평가금액은 그대로인데 돈이 나갔으니 그만큼이 수익
      flow -= dividend;
      hasTrade = true;
    }
    while (ti < sorted.length && sorted[ti].tradeDate === date) {
      const t = sorted[ti++];
      hasTrade = true;
      const fx = currencyOf(t.market) === "USD" ? t.fxRate : 1;
      const held = qty.get(t.symbol) ?? 0;
      if (t.type === "BUY") {
        qty.set(t.symbol, held + t.quantity);
        const cost = (t.quantity * t.price + t.fee + t.tax) * fx;
        flow += cost;
        bought += cost;
      } else {
        const q = Math.min(t.quantity, held);
        // 소수점 주식을 다 팔고 남는 계산 찌꺼기(1e-14주 등)는 0으로 본다. 남겨 두면 보유 금액이 0에 가까운 값이 되어
        // 그 값으로 나눈 일별 수익률이 엉뚱한 숫자가 된다 (보유 종목 계산과 같은 기준)
        const left = held - q;
        qty.set(t.symbol, left < 1e-9 ? 0 : left);
        flow -= (q * t.price - t.fee - t.tax) * fx;
      }
      lastTradePrice.set(t.symbol, t.price);
    }
    if (valuesFrom && date < valuesFrom) continue;
    // 주말은 거래가 없으면 건너뛴다 (값이 변하지 않음)
    if (isWeekend(date) && !hasTrade && date !== today) continue;

    const fxNow = fxLookup(date);
    let value = 0;
    for (const s of symbols) {
      const q = qty.get(s) ?? 0;
      if (q <= 0) continue;
      const t = firstTrade.get(s)!;
      const close = lookups.get(s)!(date) ?? lastTradePrice.get(s) ?? 0;
      const fx = currencyOf(t.market) === "USD" ? (fxNow ?? t.fxRate) : 1;
      value += q * close * fx;
    }
    // 매수금은 당일 시작 자본으로 보고, 매도대금은 장 마감 후 인출로 본다.
    // (작은 기준금액에 큰 매수가 겹쳐 수익률이 폭주하는 것을 막는다)
    // 기준금액에는 순투입이 아니라 그날 산 금액 전체를 넣는다. 보유 0에서 같은 날 사고 판 경우
    // 순투입(산 금액 − 판 금액)만 넣으면 수익률이 -100%로 계산돼 누적 수익률이 0이 되어 버린다
    const base = prevValue + bought;
    const pnl = value - prevValue - flow;
    const ret = base > 0 ? pnl / base : 0;
    points.push({ date, value, flow, ret });
    prevValue = value;
  }
  return points;
}

export type Period = "day" | "month" | "year";

export interface PeriodRow {
  period: string;
  startValue: number;
  endValue: number;
  netFlow: number;
  /** 입출금 제외 손익 */
  pnl: number;
  /** 시간가중수익률 */
  returnRate: number;
  /** 단순 평가금액 증감률 */
  valueChangeRate: number;
}

const periodKey = (date: string, period: Period) =>
  period === "day" ? date : period === "month" ? date.slice(0, 7) : date.slice(0, 4);

export function aggregate(points: DailyPoint[], period: Period, startValue = 0): PeriodRow[] {
  const rows: PeriodRow[] = [];
  // 기간 중간부터 자를 때는 직전 날의 평가금액이 첫 구간의 기초 금액이 된다
  let prevEnd = startValue;
  let cur: (PeriodRow & { growth: number }) | null = null;
  for (const p of points) {
    const k = periodKey(p.date, period);
    if (!cur || cur.period !== k) {
      if (cur) rows.push(finish(cur));
      cur = {
        period: k,
        startValue: prevEnd,
        endValue: prevEnd,
        netFlow: 0,
        pnl: 0,
        returnRate: 0,
        valueChangeRate: 0,
        growth: 1,
      };
    }
    cur.endValue = p.value;
    cur.netFlow += p.flow;
    cur.growth *= 1 + p.ret;
    prevEnd = p.value;
  }
  if (cur) rows.push(finish(cur));
  return rows;

  function finish(r: PeriodRow & { growth: number }): PeriodRow {
    const { growth, ...row } = r;
    row.pnl = row.endValue - row.startValue - row.netFlow;
    row.returnRate = growth - 1;
    row.valueChangeRate =
      row.startValue > 0 ? (row.endValue - row.startValue) / row.startValue : 0;
    return row;
  }
}

/** 차트용: 날짜, 평가금액, 누적 수익률 */
export function cumulative(points: DailyPoint[]) {
  let g = 1;
  return points.map((p) => {
    g *= 1 + p.ret;
    return { date: p.date, value: Math.round(p.value), cum: g - 1 };
  });
}

export interface BenchmarkPoint {
  date: string;
  /** 시작일 대비 누적 배수 (1 = 0%) */
  mine: number;
  [benchmark: string]: number | string;
}

/**
 * 내 시간가중수익률과 지수(예: 코스피, S&P 500)를 같은 날짜 축의 누적 배수로 맞춘다.
 * 지수 값이 없는 날은 직전 값을 쓰고, 첫 값이 나오기 전 날짜는 1로 둔다.
 */
export function benchmarkSeries(points: DailyPoint[], indices: Record<string, Map<string, number>>): BenchmarkPoint[] {
  const names = Object.keys(indices);
  const lookups = Object.fromEntries(names.map((n) => [n, carryForward(indices[n])]));
  const base: Record<string, number | undefined> = {};
  let g = 1;
  return points.map((p) => {
    g *= 1 + p.ret;
    const row: BenchmarkPoint = { date: p.date, mine: g };
    for (const n of names) {
      const v = lookups[n](p.date);
      if (v != null && base[n] == null) base[n] = v;
      row[n] = v != null && base[n] ? v / base[n]! : 1;
    }
    return row;
  });
}
