// 매매 기록 CSV 내보내기/가져오기 (엑셀에서 한글이 깨지지 않도록 UTF-8 BOM 포함)
import type { Market, TradeType } from "./portfolio";

export const CSV_COLUMNS = ["계좌", "거래일", "구분", "시장", "종목코드", "종목명", "수량", "단가", "수수료", "세금", "환율", "메모"] as const;

const TYPE_LABEL: Record<TradeType, string> = { BUY: "매수", SELL: "매도" };
const MARKET_LABEL: Record<Market, string> = { KOSPI: "코스피", KOSDAQ: "코스닥", US: "미국" };

export interface CsvTrade {
  account: string;
  tradeDate: string;
  type: TradeType;
  market: Market;
  symbol: string;
  name: string;
  quantity: number;
  price: number;
  fee: number;
  tax: number;
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
  if (!header) return { rows: [], errors: ["빈 파일입니다"] };
  const idx = Object.fromEntries(CSV_COLUMNS.map((c) => [c, header.findIndex((h) => h.trim() === c)]));
  const missing = CSV_COLUMNS.filter((c) => idx[c] < 0 && !["수수료", "세금", "환율", "메모"].includes(c));
  if (missing.length) return { rows: [], errors: [`필수 열이 없습니다: ${missing.join(", ")}`] };

  const rows: CsvTrade[] = [];
  body.forEach((cells, i) => {
    const line = i + 2;
    const get = (c: (typeof CSV_COLUMNS)[number]) => (idx[c] >= 0 ? (cells[idx[c]] ?? "").trim() : "");
    const type = pick(TYPE_LABEL, get("구분"));
    const market = pick(MARKET_LABEL, get("시장"));
    const date = get("거래일").replace(/[./]/g, "-");
    const r = {
      account: get("계좌"),
      tradeDate: date,
      type,
      market,
      symbol: get("종목코드").toUpperCase(),
      name: get("종목명"),
      quantity: num(get("수량")),
      price: num(get("단가")),
      fee: num(get("수수료")),
      tax: num(get("세금")),
      fxRate: market === "US" ? num(get("환율")) : 1,
      memo: get("메모"),
    };
    const problem =
      !r.account ? "계좌가 비어 있습니다" :
      !/^\d{4}-\d{2}-\d{2}$/.test(r.tradeDate) ? "거래일 형식이 올바르지 않습니다 (YYYY-MM-DD)" :
      !type ? "구분은 매수/매도여야 합니다" :
      !market ? "시장은 코스피/코스닥/미국이어야 합니다" :
      !r.symbol || !r.name ? "종목코드와 종목명이 필요합니다" :
      !(r.quantity > 0) || !(r.price > 0) ? "수량과 단가는 0보다 커야 합니다" :
      !(r.fee >= 0) || !(r.tax >= 0) ? "수수료·세금이 올바르지 않습니다" :
      market === "US" && !(r.fxRate > 0) ? "미국 주식은 환율이 필요합니다" :
      null;
    if (problem) errors.push(`${line}번째 줄: ${problem}`);
    else rows.push(r as CsvTrade);
  });
  return { rows, errors };
}
