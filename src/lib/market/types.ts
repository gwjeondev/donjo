import type { Market } from "../portfolio";

export interface Quote {
  symbol: string;
  price: number;
  previousClose: number | null;
  currency: string | null;
}

export interface Bar {
  /** YYYY-MM-DD (거래소 현지 날짜) */
  date: string;
  close: number;
}

export interface SymbolSearchResult {
  symbol: string;
  name: string;
  market: Market;
  exchange: string;
}

export interface MarketDataProvider {
  name: string;
  quote(symbol: string): Promise<Quote>;
  /** from 이후(포함) 일봉 종가 */
  history(symbol: string, from: string): Promise<Bar[]>;
  search(query: string): Promise<SymbolSearchResult[]>;
}
