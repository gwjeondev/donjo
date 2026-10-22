// 개발/테스트용 가짜 시세 (MARKET_DATA_PROVIDER=mock). 심볼마다 결정적인 랜덤워크를 만든다.
import type { Market } from "../portfolio";
import type { MarketDataProvider } from "./types";

function hash(s: string) {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

function basePrice(symbol: string) {
  if (symbol === "KRW=X") return 1350;
  const h = hash(symbol);
  return symbol.includes(".K") ? 10000 + (h % 90) * 1000 : 50 + (h % 300);
}

function priceOn(symbol: string, date: string) {
  const days = Math.floor(new Date(`${date}T00:00:00Z`).getTime() / 86400000);
  const h = hash(symbol);
  const vol = symbol === "KRW=X" ? 0.04 : 0.25;
  const wave = Math.sin(days / (20 + (h % 30))) * vol + Math.sin(days / 7 + h) * vol * 0.2;
  const drift = (days - 20000) * 0.0003 * ((h % 3) - 0.5);
  const p = basePrice(symbol) * (1 + wave + drift);
  return symbol.includes(".K") ? Math.round(p / 10) * 10 : Math.round(p * 100) / 100;
}

const today = () => new Date().toISOString().slice(0, 10);

function* weekdays(from: string, to: string) {
  for (let d = new Date(`${from}T00:00:00Z`); d.toISOString().slice(0, 10) <= to; d.setUTCDate(d.getUTCDate() + 1)) {
    if (d.getUTCDay() % 6 !== 0) yield d.toISOString().slice(0, 10);
  }
}

const SAMPLES: { symbol: string; name: string; market: Market }[] = [
  { symbol: "005930.KS", name: "삼성전자", market: "KOSPI" },
  { symbol: "000660.KS", name: "SK하이닉스", market: "KOSPI" },
  { symbol: "035420.KS", name: "NAVER", market: "KOSPI" },
  { symbol: "035720.KS", name: "카카오", market: "KOSPI" },
  { symbol: "247540.KQ", name: "에코프로비엠", market: "KOSDAQ" },
  { symbol: "086520.KQ", name: "에코프로", market: "KOSDAQ" },
  { symbol: "AAPL", name: "Apple Inc.", market: "US" },
  { symbol: "NVDA", name: "NVIDIA Corporation", market: "US" },
  { symbol: "TSLA", name: "Tesla, Inc.", market: "US" },
  { symbol: "QQQ", name: "Invesco QQQ Trust", market: "US" },
];

export const mockProvider: MarketDataProvider = {
  name: "mock",
  async quote(symbol) {
    const days = [...weekdays(new Date(Date.now() - 10 * 86400000).toISOString().slice(0, 10), today())];
    return {
      symbol,
      price: priceOn(symbol, days.at(-1)!),
      previousClose: priceOn(symbol, days.at(-2)!),
      currency: symbol === "KRW=X" ? "KRW" : symbol.includes(".K") ? "KRW" : "USD",
    };
  },
  async history(symbol, from) {
    return [...weekdays(from, today())].map((date) => ({ date, close: priceOn(symbol, date) }));
  },
  async search(query) {
    const q = query.toLowerCase();
    return SAMPLES.filter((s) => s.name.toLowerCase().includes(q) || s.symbol.toLowerCase().includes(q)).map(
      (s) => ({ ...s, exchange: s.market }),
    );
  },
};
