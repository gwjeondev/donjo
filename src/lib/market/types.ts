import type { Market } from "../portfolio";

export interface Quote {
  symbol: string;
  price: number;
  previousClose: number | null;
  currency: string | null;
  /** 시세를 받아 온 시각 (캐시면 캐시 저장 시각) */
  fetchedAt?: Date;
}

export interface Bar {
  /** YYYY-MM-DD (거래소 현지 날짜) */
  date: string;
  close: number;
}

/** 배당 이력 한 건: 배당락일과 주당 배당금 (현지 통화, 분할 반영된 지금 주식 수 기준) */
export interface DividendEvent {
  exDate: string;
  amount: number;
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
  /** from 이후(포함) 배당락일의 주당 배당금 */
  dividends(symbol: string, from: string): Promise<DividendEvent[]>;
}
