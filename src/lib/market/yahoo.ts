// Yahoo Finance 비공식 공개 엔드포인트 (무료, API 키 불필요, 약 15~20분 지연).
// 코스피: 005930.KS / 코스닥: 035720.KQ / 미국: AAPL / 원달러 환율: KRW=X
import type { Market } from "../portfolio";
import type { Bar, MarketDataProvider, Quote, SymbolSearchResult } from "./types";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  Accept: "application/json",
};

interface ChartResponse {
  chart: {
    result?: {
      meta: {
        regularMarketPrice?: number;
        chartPreviousClose?: number;
        previousClose?: number;
        currency?: string;
        gmtoffset?: number;
      };
      timestamp?: number[];
      indicators: { quote: { close?: (number | null)[] }[] };
    }[];
    error?: { description?: string } | null;
  };
}

async function chart(symbol: string, params: Record<string, string>) {
  const qs = new URLSearchParams({ interval: "1d", ...params });
  const res = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?${qs}`,
    { headers: HEADERS, cache: "no-store" },
  );
  if (!res.ok) throw new Error(`Yahoo chart ${symbol}: HTTP ${res.status}`);
  const json = (await res.json()) as ChartResponse;
  const result = json.chart.result?.[0];
  if (!result) throw new Error(`Yahoo chart ${symbol}: ${json.chart.error?.description ?? "no data"}`);
  return result;
}

function marketOf(symbol: string, exchange: string): Market | null {
  if (symbol.endsWith(".KS") || exchange === "KSC") return "KOSPI";
  if (symbol.endsWith(".KQ") || exchange === "KOE") return "KOSDAQ";
  if (!symbol.includes(".") && !symbol.includes("=")) return "US";
  return null;
}

export const yahooProvider: MarketDataProvider = {
  name: "yahoo",

  async quote(symbol): Promise<Quote> {
    const r = await chart(symbol, { range: "1d" });
    if (r.meta.regularMarketPrice == null) throw new Error(`Yahoo quote ${symbol}: no price`);
    return {
      symbol,
      price: r.meta.regularMarketPrice,
      previousClose: r.meta.chartPreviousClose ?? r.meta.previousClose ?? null,
      currency: r.meta.currency ?? null,
    };
  },

  async history(symbol, from): Promise<Bar[]> {
    const period1 = Math.floor(new Date(`${from}T00:00:00Z`).getTime() / 1000) - 86400;
    const period2 = Math.floor(Date.now() / 1000) + 86400;
    const r = await chart(symbol, { period1: String(period1), period2: String(period2) });
    const closes = r.indicators.quote[0]?.close ?? [];
    const offset = r.meta.gmtoffset ?? 0;
    const bars: Bar[] = [];
    (r.timestamp ?? []).forEach((ts, i) => {
      const close = closes[i];
      if (close == null) return;
      const date = new Date((ts + offset) * 1000).toISOString().slice(0, 10);
      if (date >= from) bars.push({ date, close });
    });
    return bars;
  },

  async search(query): Promise<SymbolSearchResult[]> {
    const qs = new URLSearchParams({ q: query, quotesCount: "15", newsCount: "0", listsCount: "0" });
    const res = await fetch(`https://query2.finance.yahoo.com/v1/finance/search?${qs}`, {
      headers: HEADERS,
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Yahoo search: HTTP ${res.status}`);
    const json = (await res.json()) as {
      quotes?: { symbol: string; shortname?: string; longname?: string; exchange?: string; quoteType?: string }[];
    };
    return (json.quotes ?? [])
      .filter((q) => q.quoteType === "EQUITY" || q.quoteType === "ETF")
      .flatMap((q) => {
        const market = marketOf(q.symbol, q.exchange ?? "");
        return market
          ? [{ symbol: q.symbol, name: q.longname ?? q.shortname ?? q.symbol, market, exchange: q.exchange ?? "" }]
          : [];
      });
  },
};
