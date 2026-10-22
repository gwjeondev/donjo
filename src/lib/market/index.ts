import "server-only";
import { mockProvider } from "./mock";
import type { MarketDataProvider } from "./types";
import { yahooProvider } from "./yahoo";

const providers: Record<string, MarketDataProvider> = {
  yahoo: yahooProvider,
  mock: mockProvider,
};

/** MARKET_DATA_PROVIDER 환경변수로 선택 (기본 yahoo) */
export const provider: MarketDataProvider =
  providers[process.env.MARKET_DATA_PROVIDER ?? "yahoo"] ?? yahooProvider;

export type { MarketDataProvider, Quote, Bar, SymbolSearchResult } from "./types";
