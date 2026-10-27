import "server-only";
import { mockKoreanSource, mockProvider } from "./mock";
import { naverSource, type KoreanStockSource } from "./naver";
import type { MarketDataProvider } from "./types";
import { yahooProvider } from "./yahoo";

const providers: Record<string, MarketDataProvider> = {
  yahoo: yahooProvider,
  mock: mockProvider,
};

const SLOW_FETCH_MS = 1500;

/** 외부 시세 요청이 느리면 로그에 남긴다 (어디서 느린지 찾기 위해) */
function timed(p: MarketDataProvider): MarketDataProvider {
  const wrap =
    <A extends unknown[], R>(name: string, fn: (...a: A) => Promise<R>) =>
    async (...a: A): Promise<R> => {
      const t = Date.now();
      try {
        return await fn(...a);
      } finally {
        const ms = Date.now() - t;
        if (ms >= SLOW_FETCH_MS) console.warn(`[market] 느린 외부 요청 ${ms}ms ${name} ${String(a[0])}`);
      }
    };
  return { name: p.name, quote: wrap("quote", p.quote), history: wrap("history", p.history), search: wrap("search", p.search) };
}

/** MARKET_DATA_PROVIDER 환경변수로 선택 (기본 yahoo) */
export const provider: MarketDataProvider = timed(providers[process.env.MARKET_DATA_PROVIDER ?? "yahoo"] ?? yahooProvider);

/** 국내 종목 한글 검색·이름 (기본 네이버 증권, mock 모드에서는 가짜 데이터) */
export const koreanSource: KoreanStockSource = process.env.MARKET_DATA_PROVIDER === "mock" ? mockKoreanSource : naverSource;

export type { MarketDataProvider, Quote, Bar, SymbolSearchResult } from "./types";
