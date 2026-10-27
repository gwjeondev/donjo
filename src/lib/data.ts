// 페이지에서 쓰는 데이터 로딩 (DB 기록 + 시세 결합)
import "server-only";
import { cache } from "react";
import type { CashFlow as CashRow, Dividend as DividendRow, Transaction } from "@prisma/client";
import { cashBalances, cashTimeline, totalCash, type CashFlow } from "./cash";
import { dividendNetKrw, type Dividend } from "./income";
import { prisma } from "./db";
import { readPrefs } from "./prefs";
import { getPriceSeries, getQuotes, todayStr, usdKrwFrom, type PriceWindows } from "./market/service";
import { addDays, benchmarkSeries, buildDailySeries, FX_SYMBOL, type DailyPoint } from "./performance";

/** 수익률 비교용 지수 (Yahoo 심볼) */
const BENCHMARKS = { kospi: "^KS11", sp500: "^GSPC", nasdaq100: "^NDX" } as const;
import { computePositions, summarize, valuePosition, type Trade } from "./portfolio";

/** 사용자 화면 설정 (없거나 형식이 틀리면 기본값) */
export const loadPrefs = cache(async (userId: string) => {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { prefs: true } });
  const prefs = readPrefs(u?.prefs);
  // 연동 시작 시각이 없던 때 켠 경우: 지금을 시작으로 정해 둔다 (이미 있는 기록은 현금에 반영하지 않는다)
  if (prefs.cash === "linked" && !prefs.cashSince) {
    prefs.cashSince = new Date().toISOString();
    await prisma.user.update({ where: { id: userId }, data: { prefs: JSON.parse(JSON.stringify(prefs)) } });
  }
  return prefs;
});

export function toTrade(t: Transaction): Trade {
  return {
    id: t.id,
    accountId: t.accountId,
    symbol: t.symbol,
    name: t.name,
    market: t.market,
    type: t.type,
    quantity: Number(t.quantity),
    price: Number(t.price),
    fee: Number(t.fee),
    tax: Number(t.tax),
    fxRate: Number(t.fxRate),
    tradeDate: t.tradeDate.toISOString().slice(0, 10),
    createdAt: t.createdAt.toISOString(),
    memo: t.memo,
  };
}

export function toDividend(d: DividendRow): Dividend {
  return {
    id: d.id,
    accountId: d.accountId,
    symbol: d.symbol,
    name: d.name,
    market: d.market,
    amount: Number(d.amount),
    tax: Number(d.tax),
    fxRate: Number(d.fxRate),
    payDate: d.payDate.toISOString().slice(0, 10),
    createdAt: d.createdAt.toISOString(),
    memo: d.memo,
  };
}

export function toCashFlow(c: CashRow): CashFlow {
  return {
    id: c.id,
    accountId: c.accountId,
    type: c.type,
    currency: c.currency,
    amount: Number(c.amount),
    fxRate: Number(c.fxRate),
    date: c.date.toISOString().slice(0, 10),
    createdAt: c.createdAt.toISOString(),
    memo: c.memo,
  };
}

/** 현금 입출금·환전 기록 (최근이 위) */
export const loadCashFlows = cache(async (userId: string, accountId?: string) => {
  const rows = await prisma.cashFlow.findMany({
    where: { account: { userId }, ...(accountId ? { accountId } : {}) },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });
  return rows.map(toCashFlow);
});

/** 배당금 기록 (최근 지급일이 위) */
export const loadDividends = cache(async (userId: string, accountId?: string) => {
  const rows = await prisma.dividend.findMany({
    where: { account: { userId }, ...(accountId ? { accountId } : {}) },
    orderBy: [{ payDate: "desc" }, { createdAt: "desc" }],
  });
  return rows.map(toDividend);
});

/** 배당 입력용 종목 목록: 계좌별로 거래한 적 있는 종목 (기록이 최신순이라 처음 만나는 이름이 현재 이름) */
export function dividendStocks(trades: Trade[]) {
  const m = new Map<string, { accountId: string; symbol: string; name: string; market: Trade["market"] }>();
  for (const t of trades) {
    const k = `${t.accountId}|${t.symbol}`;
    if (!m.has(k)) m.set(k, { accountId: t.accountId, symbol: t.symbol, name: t.name, market: t.market });
  }
  return [...m.values()].sort((a, b) => a.name.localeCompare(b.name, "ko"));
}

/** 날짜별 세후 배당금(원화) 합계 — 수익률 계산용 */
function dividendsByDate(dividends: Dividend[]) {
  const m = new Map<string, number>();
  for (const d of dividends) m.set(d.payDate, (m.get(d.payDate) ?? 0) + dividendNetKrw(d));
  return m;
}

export const loadTrades = cache(async (userId: string, accountId?: string) => {
  const rows = await prisma.transaction.findMany({
    where: { account: { userId }, ...(accountId ? { accountId } : {}) },
    orderBy: [{ tradeDate: "desc" }, { createdAt: "desc" }],
  });
  return rows.map(toTrade);
});

export async function loadPortfolio(userId: string, accountId?: string) {
  const [accounts, trades, dividends, flows, prefs] = await Promise.all([
    prisma.account.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    loadTrades(userId, accountId),
    loadDividends(userId, accountId),
    loadCashFlows(userId, accountId),
    loadPrefs(userId),
  ]);
  const positions = computePositions(trades);
  const held = positions.filter((p) => p.quantity > 0);
  // 환율도 같은 조회에 넣는다 (DB 왕복 한 번 절약)
  const quotes = await getQuotes([...held.map((p) => p.symbol), FX_SYMBOL]);
  const fx = usdKrwFrom(quotes);
  const valued = positions.map((p) => valuePosition(p, quotes.get(p.symbol), fx.rate));
  // 화면에 보이는 시세 중 가장 오래된 것의 시각 ("n분 전 시세" 표시용)
  const times = [...quotes.values()].flatMap((q) => (q.fetchedAt ? [q.fetchedAt.getTime()] : []));
  const quotedAt = times.length ? new Date(Math.min(...times)).toISOString() : null;
  /** 받은 배당금 합계 (세후, 원화) */
  const dividendKrw = dividends.reduce((s, d) => s + dividendNetKrw(d), 0);
  /** 계좌별 현금 잔고와 합계 (원화·달러) */
  const cashByAccount = cashBalances(flows, trades, dividends, prefs.cash, prefs.cashSince);
  const cash = totalCash(cashByAccount);
  return { accounts, trades, positions: valued, summary: summarize(valued), dividendKrw, cash, cashByAccount, fx, quotedAt };
}

/** 수익률 시계열. 시세·일봉 조회가 실패해도 페이지 전체가 깨지지 않도록 failed로 알린다 */
/**
 * from을 주면 그 날짜 부근부터만 시세를 받아 계산한다 (수익률 화면의 1M 등 짧은 기간을 빨리 보여 주기 위해).
 * 수익률은 기간 안의 일별 수익률을 이어 곱하므로 그 이전 시세는 필요 없다.
 */
export async function loadPerformance(userId: string, accountId?: string, from?: string, market?: "kr" | "us") {
  try {
    return { ...(await computePerformance(userId, accountId, from, market)), failed: false };
  } catch (e) {
    console.error("[performance] 계산 실패:", e);
    return { ...EMPTY_PERFORMANCE, failed: true };
  }
}

const EMPTY_PERFORMANCE = {
  daily: [] as DailyPoint[],
  benchmark: [] as ReturnType<typeof benchmarkSeries>,
  benchmarkMissing: [] as string[],
  /** 첫 거래일 (직접입력 날짜 범위용) */
  firstTrade: undefined as string | undefined,
  /** 날짜별 현금(원화 환산) — 자산 추이에 더한다 */
  cashDaily: {} as Record<string, number>,
};

async function computePerformance(userId: string, accountId?: string, rangeFrom?: string, market?: "kr" | "us") {
  // 국내/해외만 볼 때는 그 시장의 매매·배당만으로 계산한다
  const isMarket = (m: string) => !market || (market === "us" ? m === "US" : m !== "US");
  const [allTrades, allDividends] = await Promise.all([loadTrades(userId, accountId), loadDividends(userId, accountId)]);
  const trades = allTrades.filter((t) => isMarket(t.market));
  const dividends = allDividends.filter((d) => isMarket(d.market));
  if (trades.length === 0) return EMPTY_PERFORMANCE;
  const firstTrade = trades.reduce((m, t) => (t.tradeDate < m ? t.tradeDate : m), trades[0].tradeDate);
  // 기간 시작 직전 거래일(수익률 0% 기준점)이 들어가도록 일주일 앞부터 계산한다
  const valuesFrom = rangeFrom && rangeFrom > firstTrade ? addDays(rangeFrom, -7) : undefined;
  const from = valuesFrom ?? firstTrade;
  // 그 시점에 보유 중이었거나 그 뒤에 거래한 종목만 시세가 필요하다
  const symbols = valuesFrom
    ? [
        ...computePositions(trades.filter((t) => t.tradeDate < valuesFrom)).filter((p) => p.quantity > 0).map((p) => p.symbol),
        ...trades.filter((t) => t.tradeDate >= valuesFrom).map((t) => t.symbol),
      ]
    : trades.map((t) => t.symbol);
  // 지금은 보유하지 않는 종목: 마지막 거래일까지만 시세가 필요하다 (오늘 시세도 필요 없다)
  const heldNow = new Set(computePositions(trades).filter((p) => p.quantity > 0).map((p) => p.symbol));
  const doneAt = new Map<string, string>();
  for (const t of trades) if (!heldNow.has(t.symbol) && t.tradeDate > (doneAt.get(t.symbol) ?? "")) doneAt.set(t.symbol, t.tradeDate);
  // 종목마다 보유한 기간의 시세만 읽는다: 첫 거래일부터, 지금 안 가진 종목은 마지막 거래일(+며칠)까지
  const windows: PriceWindows = new Map();
  for (const t of trades) {
    const w = windows.get(t.symbol);
    if (!w) windows.set(t.symbol, { from: t.tradeDate });
    else if (t.tradeDate < w.from) w.from = t.tradeDate;
  }
  for (const [symbol, end] of doneAt) windows.get(symbol)!.to = addDays(end, 5);
  const prices = await getPriceSeries([...symbols, ...Object.values(BENCHMARKS)], from, doneAt, windows);
  const today = todayStr();
  // 오늘 가격은 최신 시세로 덮어써서 대시보드 평가금액과 맞춘다 (보유 중인 종목만)
  const quotes = await getQuotes([...new Set(symbols.filter((s) => heldNow.has(s))), "KRW=X"]);
  for (const [s, q] of quotes) {
    if (!prices.has(s)) prices.set(s, new Map());
    prices.get(s)!.set(today, q.price);
  }
  const daily = buildDailySeries(trades, prices, today, dividendsByDate(dividends), valuesFrom);
  const benchmark = benchmarkSeries(
    daily,
    Object.fromEntries(Object.entries(BENCHMARKS).map(([k, sym]) => [k, prices.get(sym) ?? new Map<string, number>()])),
  );
  // 지수 시세를 못 받은 경우 0% 평평한 선 대신 "불러오지 못함"으로 보여 주기 위해
  const benchmarkMissing = Object.entries(BENCHMARKS)
    .filter(([, sym]) => !(prices.get(sym)?.size))
    .map(([k]) => k);
  // 자산 추이용: 날짜별 현금 잔고(원화 환산). 국내/해외만 볼 때는 현금을 넣지 않는다
  const cashDaily: Record<string, number> = {};
  if (!market) {
    const [flows, prefs] = await Promise.all([loadCashFlows(userId, accountId), loadPrefs(userId)]);
    const timeline = cashTimeline(flows, allTrades, allDividends, prefs.cash, prefs.cashSince);
    if (timeline.length) {
      const fx = prices.get(FX_SYMBOL);
      const fxDates = fx ? [...fx.keys()].sort() : [];
      let ti = -1;
      let fi = -1;
      for (const p of daily) {
        while (ti + 1 < timeline.length && timeline[ti + 1].date <= p.date) ti++;
        while (fi + 1 < fxDates.length && fxDates[fi + 1] <= p.date) fi++;
        if (ti < 0) continue;
        const rate = fi >= 0 ? fx!.get(fxDates[fi])! : 0;
        cashDaily[p.date] = timeline[ti].krw + timeline[ti].usd * rate;
      }
    }
  }
  return { daily, benchmark, benchmarkMissing, firstTrade, cashDaily };
}
