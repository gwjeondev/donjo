import "server-only";
import { mockKoreanSource, mockProvider } from "./mock";
import { naverSource, type KoreanStockSource } from "./naver";
import type { MarketDataProvider } from "./types";
import { yahooProvider } from "./yahoo";

const providers: Record<string, MarketDataProvider> = {
  yahoo: yahooProvider,
  mock: mockProvider,
};

/** MARKET_DATA_PROVIDER 환경변수로 선택 (기본 yahoo) */
export const provider: MarketDataProvider =
  providers[process.env.MARKET_DATA_PROVIDER ?? "yahoo"] ?? yahooProvider;

/** 국내 종목 한글 검색·이름 (기본 네이버 증권, mock 모드에서는 가짜 데이터) */
export const koreanSource: KoreanStockSource = process.env.MARKET_DATA_PROVIDER === "mock" ? mockKoreanSource : naverSource;

export type { MarketDataProvider, Quote, Bar, SymbolSearchResult } from "./types";
