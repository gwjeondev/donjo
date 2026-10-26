// 개발/테스트용 가짜 시세 (MARKET_DATA_PROVIDER=mock). 심볼마다 결정적인 랜덤워크를 만든다.
import type { Market } from "../portfolio";
import type { KoreanStockSource } from "./naver";
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
  // 분기마다 배당 (미국: 2·5·8·11월 10일, 국내: 3·6·9·12월 27일). 종목마다 금액이 다르고 일부 종목은 배당이 없다
  async dividends(symbol, from) {
    const h = hash(symbol);
    if (symbol === "KRW=X" || h % 4 === 0) return [];
    const kr = symbol.includes(".K");
    const out: { exDate: string; amount: number }[] = [];
    for (let y = Number(from.slice(0, 4)); y <= Number(today().slice(0, 4)); y++) {
      for (const m of kr ? [3, 6, 9, 12] : [2, 5, 8, 11]) {
        const exDate = `${y}-${String(m).padStart(2, "0")}-${kr ? "27" : "10"}`;
        if (exDate >= from && exDate <= today()) out.push({ exDate, amount: kr ? 100 + (h % 5) * 100 : 0.2 + (h % 5) / 10 });
      }
    }
    return out;
  },
  async history(symbol, from) {
    return [...weekdays(from, today())].map((date) => ({ date, close: priceOn(symbol, date) }));
  },
  async search(query) {
    const q = query.toLowerCase();
    return SAMPLES.filter((s) => s.name.toLowerCase().includes(q) || s.symbol.toLowerCase().includes(q)).map((s) => ({
      ...s,
      exchange: s.market,
    }));
  },
};

// 개발/테스트용 국내 종목 한글 이름 (네이버 대신)
const KR_NAMES: Record<string, string> = {
  ...Object.fromEntries(SAMPLES.filter((s) => s.market !== "US").map((s) => [s.symbol.slice(0, 6), s.name])),
  "381180": "TIGER 미국필라델피아반도체나스닥",
  "379810": "KODEX 미국나스닥100",
  "0193T0": "TIME 글로벌AI인공지능액티브",
  "0091P0": "TIME 미국나스닥100채권혼합50액티브",
  "456600": "TIME 글로벌AI인공지능액티브",
};

// 개발/테스트용 미국 종목 한글 이름 (네이버 대신)
const US_KO_NAMES: Record<string, string> = {
  AAPL: "애플",
  GOOGL: "알파벳 A",
  NVDA: "엔비디아",
  TSLA: "테슬라",
  "BRK-B": "버크셔 해서웨이 B",
};

export const mockKoreanSource: KoreanStockSource = {
  async search(query) {
    const q = query.toLowerCase();
    const us = Object.entries(US_KO_NAMES)
      .filter(([ticker, name]) => name.includes(query) || ticker.toLowerCase() === q)
      .map(([ticker, name]) => ({ symbol: ticker, name, market: "US" as const, exchange: "US" }));
    return [
      ...us,
      ...Object.entries(KR_NAMES)
        .filter(([code, name]) => name.toLowerCase().includes(q) || code.includes(q))
        .map(([code, name]) => {
          const market = SAMPLES.find((s) => s.symbol.startsWith(code))?.market ?? "KOSPI";
          return { symbol: `${code}.${market === "KOSDAQ" ? "KQ" : "KS"}`, name, market, exchange: market };
        }),
    ];
  },
  async lookup(code) {
    const name = KR_NAMES[code];
    if (!name) return null;
    return { name, market: SAMPLES.find((s) => s.symbol.startsWith(code))?.market ?? "KOSPI" };
  },
};
