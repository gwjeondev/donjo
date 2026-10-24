// 페이지에서 쓰는 데이터 로딩 (DB 기록 + 시세 결합)
import "server-only";
import type { Dividend as DividendRow, Transaction } from "@prisma/client";
import { dividendNetKrw, type Dividend } from "./income";
import { prisma } from "./db";
import { readPrefs } from "./prefs";
import { getPriceSeries, getQuotes, getUsdKrw, todayStr } from "./market/service";
import { benchmarkSeries, buildDailySeries, type DailyPoint } from "./performance";

/** 수익률 비교용 지수 (Yahoo 심볼) */
const BENCHMARKS = { kospi: "^KS11", sp500: "^GSPC", nasdaq100: "^NDX" } as const;
import { computePositions, summarize, valuePosition, type Trade } from "./portfolio";

/** 사용자 화면 설정 (없거나 형식이 틀리면 기본값) */
export async function loadPrefs(userId: string) {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { prefs: true } });
  return readPrefs(u?.prefs);
}

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
    memo: d.memo,
  };
}

/** 배당금 기록 (최근 지급일이 위) */
export async function loadDividends(userId: string, accountId?: string) {
  const rows = await prisma.dividend.findMany({
    where: { account: { userId }, ...(accountId ? { accountId } : {}) },
    orderBy: [{ payDate: "desc" }, { createdAt: "desc" }],
  });
  return rows.map(toDividend);
}

/** 날짜별 세후 배당금(원화) 합계 — 수익률 계산용 */
function dividendsByDate(dividends: Dividend[]) {
  const m = new Map<string, number>();
  for (const d of dividends) m.set(d.payDate, (m.get(d.payDate) ?? 0) + dividendNetKrw(d));
  return m;
}

export async function loadTrades(userId: string, accountId?: string) {
  const rows = await prisma.transaction.findMany({
    where: { account: { userId }, ...(accountId ? { accountId } : {}) },
    orderBy: [{ tradeDate: "desc" }, { createdAt: "desc" }],
  });
  return rows.map(toTrade);
}

export async function loadPortfolio(userId: string, accountId?: string) {
  const [accounts, trades, dividends] = await Promise.all([
    prisma.account.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    loadTrades(userId, accountId),
    loadDividends(userId, accountId),
  ]);
  const positions = computePositions(trades);
  const held = positions.filter((p) => p.quantity > 0);
  const [quotes, fx] = await Promise.all([getQuotes(held.map((p) => p.symbol)), getUsdKrw()]);
  const valued = positions.map((p) => valuePosition(p, quotes.get(p.symbol), fx.rate));
  // 화면에 보이는 시세 중 가장 오래된 것의 시각 ("n분 전 시세" 표시용)
  const times = [...quotes.values()].flatMap((q) => (q.fetchedAt ? [q.fetchedAt.getTime()] : []));
  const quotedAt = times.length ? new Date(Math.min(...times)).toISOString() : null;
  /** 받은 배당금 합계 (세후, 원화) */
  const dividendKrw = dividends.reduce((s, d) => s + dividendNetKrw(d), 0);
  return { accounts, trades, positions: valued, summary: summarize(valued), dividendKrw, fx, quotedAt };
}

/** 수익률 시계열. 시세·일봉 조회가 실패해도 페이지 전체가 깨지지 않도록 failed로 알린다 */
export async function loadPerformance(userId: string, accountId?: string) {
  try {
    return { ...(await computePerformance(userId, accountId)), failed: false };
  } catch (e) {
    console.error("[performance] 계산 실패:", e);
    return { ...EMPTY_PERFORMANCE, failed: true };
  }
}

const EMPTY_PERFORMANCE = {
  daily: [] as DailyPoint[],
  benchmark: [] as ReturnType<typeof benchmarkSeries>,
  benchmarkMissing: [] as string[],
};

async function computePerformance(userId: string, accountId?: string) {
  const [trades, dividends] = await Promise.all([loadTrades(userId, accountId), loadDividends(userId, accountId)]);
  if (trades.length === 0) return EMPTY_PERFORMANCE;
  const from = trades.reduce((m, t) => (t.tradeDate < m ? t.tradeDate : m), trades[0].tradeDate);
  const prices = await getPriceSeries([...trades.map((t) => t.symbol), ...Object.values(BENCHMARKS)], from);
  const today = todayStr();
  // 오늘 가격은 최신 시세로 덮어써서 대시보드 평가금액과 맞춘다
  const quotes = await getQuotes([...new Set(trades.map((t) => t.symbol)), "KRW=X"]);
  for (const [s, q] of quotes) {
    if (!prices.has(s)) prices.set(s, new Map());
    prices.get(s)!.set(today, q.price);
  }
  const daily = buildDailySeries(trades, prices, today, dividendsByDate(dividends));
  const benchmark = benchmarkSeries(
    daily,
    Object.fromEntries(Object.entries(BENCHMARKS).map(([k, sym]) => [k, prices.get(sym) ?? new Map<string, number>()])),
  );
  // 지수 시세를 못 받은 경우 0% 평평한 선 대신 "불러오지 못함"으로 보여 주기 위해
  const benchmarkMissing = Object.entries(BENCHMARKS)
    .filter(([, sym]) => !(prices.get(sym)?.size))
    .map(([k]) => k);
  return { daily, benchmark, benchmarkMissing };
}
