// 페이지에서 쓰는 데이터 로딩 (DB 기록 + 시세 결합)
import "server-only";
import type { Transaction } from "@prisma/client";
import { prisma } from "./db";
import { getPriceSeries, getQuotes, getUsdKrw, todayStr } from "./market/service";
import { aggregate, buildDailySeries } from "./performance";
import { computePositions, summarize, valuePosition, type Trade } from "./portfolio";

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

export async function loadTrades(userId: string, accountId?: string) {
  const rows = await prisma.transaction.findMany({
    where: { account: { userId }, ...(accountId ? { accountId } : {}) },
    orderBy: [{ tradeDate: "desc" }, { createdAt: "desc" }],
  });
  return rows.map(toTrade);
}

export async function loadPortfolio(userId: string, accountId?: string) {
  const [accounts, trades] = await Promise.all([
    prisma.account.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    loadTrades(userId, accountId),
  ]);
  const positions = computePositions(trades);
  const held = positions.filter((p) => p.quantity > 0);
  const [quotes, fx] = await Promise.all([getQuotes(held.map((p) => p.symbol)), getUsdKrw()]);
  const valued = positions.map((p) => valuePosition(p, quotes.get(p.symbol), fx.rate));
  // 화면에 보이는 시세 중 가장 오래된 것의 시각 ("n분 전 시세" 표시용)
  const times = [...quotes.values()].flatMap((q) => (q.fetchedAt ? [q.fetchedAt.getTime()] : []));
  const quotedAt = times.length ? new Date(Math.min(...times)).toISOString() : null;
  return { accounts, trades, positions: valued, summary: summarize(valued), fx, quotedAt };
}

/** 수익률 시계열. 시세·일봉 조회가 실패해도 페이지 전체가 깨지지 않도록 failed로 알린다 */
export async function loadPerformance(userId: string, accountId?: string) {
  try {
    return { ...(await computePerformance(userId, accountId)), failed: false };
  } catch (e) {
    console.error("[performance] 계산 실패:", e);
    return { daily: [], day: [], month: [], year: [], failed: true };
  }
}

async function computePerformance(userId: string, accountId?: string) {
  const trades = await loadTrades(userId, accountId);
  if (trades.length === 0) return { daily: [], day: [], month: [], year: [] };
  const from = trades.reduce((m, t) => (t.tradeDate < m ? t.tradeDate : m), trades[0].tradeDate);
  const prices = await getPriceSeries(trades.map((t) => t.symbol), from);
  const today = todayStr();
  // 오늘 가격은 최신 시세로 덮어써서 대시보드 평가금액과 맞춘다
  const quotes = await getQuotes([...new Set(trades.map((t) => t.symbol)), "KRW=X"]);
  for (const [s, q] of quotes) {
    if (!prices.has(s)) prices.set(s, new Map());
    prices.get(s)!.set(today, q.price);
  }
  const daily = buildDailySeries(trades, prices, today);
  return {
    daily,
    day: aggregate(daily, "day"),
    month: aggregate(daily, "month"),
    year: aggregate(daily, "year"),
  };
}
