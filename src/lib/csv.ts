// 매매 기록 CSV 내보내기/가져오기 (엑셀에서 한글이 깨지지 않도록 UTF-8 BOM 포함)
import type { Market, TradeType } from "./portfolio";

export const CSV_COLUMNS = ["계좌", "거래일", "구분", "시장", "종목코드", "종목명", "수량", "단가", "수수료", "세금", "환율", "메모"] as const;

const TYPE_LABEL: Record<TradeType, string> = { BUY: "매수", SELL: "매도" };
/** 내보내기는 국내/해외로 쓴다 */
/** 가져오기 시장 칸: 국내/해외(권장) 또는 코스피/코스닥/미국. "KR"은 국내인데 거래소(코스피/코스닥)를 아직 모르는 상태 */
export type CsvMarket = Market | "KR";
const MARKET_LABEL: Record<CsvMarket, string> = { KOSPI: "국내", KOSDAQ: "국내", KR: "국내", US: "해외" };
const MARKET_WORDS: Record<string, CsvMarket> = {
  국내: "KR", 한국: "KR", KR: "KR", KOR: "KR",
  해외: "US", 미국: "US", US: "US", USA: "US",
  코스피: "KOSPI", 유가증권: "KOSPI", KOSPI: "KOSPI",
  코스닥: "KOSDAQ", KOSDAQ: "KOSDAQ",
};
const KR_CODE = /^[0-9][0-9A-Z]{5}$/;

export interface CsvTrade {
  account: string;
  tradeDate: string;
  type: TradeType;
  market: CsvMarket;
  symbol: string;
  name: string;
  quantity: number;
  price: number;
  fee: number;
  tax: number;
  /** 1 USD 당 KRW. 미국 주식에서 0이면 가져올 때 거래일 환율로 채운다 */
  fxRate: number;
  memo: string;
}

function escape(v: string | number) {
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: CsvTrade[]): string {
  const lines = [CSV_COLUMNS.join(",")];
  for (const r of rows) {
    lines.push(
      [r.account, r.tradeDate, TYPE_LABEL[r.type], MARKET_LABEL[r.market], r.symbol.replace(/\.(KS|KQ)$/, ""), r.name, r.quantity, r.price, r.fee, r.tax, r.market === "US" ? r.fxRate : "", r.memo]
        .map(escape)
        .join(","),
    );
  }
  return `﻿${lines.join("\r\n")}\r\n`;
}

/** RFC 4180 CSV 파서 (따옴표 안의 쉼표·줄바꿈·"" 처리) */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((f) => f.trim()));
}

const pick = <T extends string>(map: Record<T, string>, value: string): T | undefined => {
  const v = value.trim();
  return (Object.keys(map) as T[]).find((k) => k === v.toUpperCase() || map[k] === v);
};

const num = (v: string) => Number(v.replace(/[,\s원$]/g, "") || "0");

/** CSV를 매매 기록으로 변환. 잘못된 줄은 줄 번호와 함께 errors에 담는다 */
export function fromCsv(text: string): { rows: CsvTrade[]; errors: string[] } {
  const [header, ...body] = parseCsv(text);
  const errors: string[] = [];
  if (!header) return { rows: [], errors: ["빈 파일이에요"] };
  const idx = Object.fromEntries(CSV_COLUMNS.map((c) => [c, header.findIndex((h) => h.trim() === c)]));
  const missing = CSV_COLUMNS.filter((c) => idx[c] < 0 && !["시장", "수수료", "세금", "환율", "메모"].includes(c));
  if (missing.length) return { rows: [], errors: [`필수 열이 없어요: ${missing.join(", ")}`] };

  const rows: CsvTrade[] = [];
  body.forEach((cells, i) => {
    const line = i + 2;
    const get = (c: (typeof CSV_COLUMNS)[number]) => (idx[c] >= 0 ? (cells[idx[c]] ?? "").trim() : "");
    const type = pick(TYPE_LABEL, get("구분"));
    // 시장 칸이 비어 있으면 종목코드로 판단: 숫자 코드는 국내, 영문 티커는 해외
    const marketWord = get("시장");
    const code = get("종목코드").toUpperCase().replace(/\.(KS|KQ)$/, "");
    const market: CsvMarket | undefined = marketWord
      ? MARKET_WORDS[marketWord.toUpperCase()] ?? MARKET_WORDS[marketWord]
      : KR_CODE.test(code) ? "KR" : code ? "US" : undefined;
    const date = get("거래일").replace(/[./]/g, "-");
    const r = {
      account: get("계좌"),
      tradeDate: date,
      type,
      market,
      symbol: code,
      name: get("종목명"),
      quantity: num(get("수량")),
      price: num(get("단가")),
      fee: num(get("수수료")),
      tax: num(get("세금")),
      fxRate: market === "US" ? num(get("환율")) : 1,
      memo: get("메모"),
    };
    const problem =
      !r.account ? "계좌가 비어 있어요" :
      !/^\d{4}-\d{2}-\d{2}$/.test(r.tradeDate) ? "거래일 형식이 올바르지 않아요 (YYYY-MM-DD)" :
      !type ? "구분은 매수/매도여야 해요" :
      !market ? "시장은 국내/해외로 적어 주세요 (비우면 종목코드로 판단해요)" :
      !r.symbol || !r.name ? "종목코드와 종목명이 필요해요" :
      !(r.quantity > 0) || !(r.price > 0) ? "수량과 단가는 0보다 커야 해요" :
      !(r.fee >= 0) || !(r.tax >= 0) ? "수수료·세금이 올바르지 않아요" :
      market === "US" && !(r.fxRate >= 0) ? "환율이 올바르지 않아요" :
      null;
    if (problem) errors.push(`${line}번째 줄: ${problem}`);
    else rows.push(r as CsvTrade);
  });
  return { rows, errors };
}
