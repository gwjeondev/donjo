// 네이버 증권 (비공식 공개 엔드포인트): 국내 종목 한글 검색과 증권사 표기 이름.
// 공개 문서가 없어 응답 형식이 바뀔 수 있으므로, 필드를 여러 후보로 읽고 실패하면 null/빈 목록을 돌려준다.
import type { Market } from "../portfolio";
import type { SymbolSearchResult } from "./types";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  Accept: "application/json",
  Referer: "https://m.stock.naver.com/",
};
const TIMEOUT_MS = 3000;

/** 국내 종목코드: 숫자 6자리 또는 신규 형식(예: 0193T0) */
const KR_CODE = /^[0-9][0-9A-Z]{5}$/;

function marketFrom(...hints: unknown[]): Market | null {
  const text = hints.filter((h) => typeof h === "string").join(" ").toUpperCase();
  if (!text) return null;
  if (/KOSDAQ|코스닥|\bKQ\b/.test(text)) return "KOSDAQ";
  if (/KOSPI|코스피|\bKS\b|유가/.test(text)) return "KOSPI";
  return null;
}

type Obj = Record<string, unknown>;
const asObj = (v: unknown): Obj => (v && typeof v === "object" ? (v as Obj) : {});
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** 자동완성 응답 → 국내 종목 검색 결과 (해외·지수 등은 제외) */
export function parseSearch(json: unknown): SymbolSearchResult[] {
  const root = asObj(json);
  const items = Array.isArray(root.items) ? root.items : Array.isArray(root.result) ? root.result : [];
  const out: SymbolSearchResult[] = [];
  for (const raw of items.flat()) {
    const it = asObj(raw);
    const code = str(it.code || it.itemCode || it.reutersCode).toUpperCase();
    const name = str(it.name || it.stockName);
    const nation = str(it.nationCode || it.nation);
    if (!KR_CODE.test(code) || !name || (nation && nation !== "KOR")) continue;
    const category = str(it.category);
    if (category && category !== "stock" && category !== "etf") continue;
    const market = marketFrom(it.typeCode, it.typeName, it.stockExchangeName, asObj(it.stockExchangeType).code) ?? "KOSPI";
    out.push({ symbol: `${code}.${market === "KOSDAQ" ? "KQ" : "KS"}`, name, market, exchange: market });
  }
  return out;
}

/** 종목 기본정보 응답 → 한글 이름 */
export function parseName(json: unknown): string | null {
  const o = asObj(json);
  const name = str(o.stockName || o.itemName || o.name || asObj(o.stockItem).stockName);
  return name || null;
}

async function getJson(url: string) {
  const res = await fetch(url, { headers: HEADERS, cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`naver ${res.status}`);
  return res.json();
}

export interface KoreanStockSource {
  search(query: string): Promise<SymbolSearchResult[]>;
  /** 종목코드(6자리)로 증권사 표기 이름 조회 */
  name(code: string): Promise<string | null>;
}

export const naverSource: KoreanStockSource = {
  async search(query) {
    const qs = new URLSearchParams({ q: query, target: "stock" });
    return parseSearch(await getJson(`https://ac.stock.naver.com/ac?${qs}`));
  },
  async name(code) {
    if (!KR_CODE.test(code)) return null;
    return parseName(await getJson(`https://m.stock.naver.com/api/stock/${encodeURIComponent(code)}/basic`));
  },
};
