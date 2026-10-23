import { describe, expect, it } from "vitest";
import { fromCsv, parseCsv, toCsv, type CsvTrade } from "../csv";

const sample: CsvTrade[] = [
  { account: "토스", tradeDate: "2026-10-23", type: "BUY", market: "US", symbol: "SNDK", name: "Sandisk, Inc.", quantity: 10.845626, price: 1485.27, fee: 0, tax: 0, fxRate: 1430, memo: '반도체 "비중" 확대' },
  { account: "일반", tradeDate: "2026-09-01", type: "SELL", market: "KOSPI", symbol: "005930.KS", name: "삼성전자", quantity: 3, price: 71000, fee: 10, tax: 383, fxRate: 1, memo: "" },
];

describe("csv", () => {
  it("내보낸 CSV를 다시 읽으면 같은 기록이 된다", () => {
    const csv = toCsv(sample);
    expect(csv.startsWith("﻿계좌,거래일")).toBe(true);
    const { rows, errors } = fromCsv(csv);
    expect(errors).toEqual([]);
    expect(rows).toEqual([sample[0], { ...sample[1], symbol: "005930" }]);
  });

  it("따옴표 안의 쉼표와 줄바꿈을 처리한다", () => {
    expect(parseCsv('a,"b,c","d\n""e"""\r\n1,2,3')).toEqual([["a", "b,c", 'd\n"e"'], ["1", "2", "3"]]);
  });

  it("잘못된 줄은 줄 번호와 함께 알려 준다", () => {
    const csv = "계좌,거래일,구분,시장,종목코드,종목명,수량,단가\n일반,2026/10/01,매수,코스피,005930,삼성전자,\"1,000\",70000\n일반,어제,매수,코스피,005930,삼성전자,1,1\n일반,2026-10-01,보유,코스피,005930,삼성전자,1,1";
    const { rows, errors } = fromCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ tradeDate: "2026-10-01", quantity: 1000, fxRate: 1 });
    expect(errors).toEqual(["3번째 줄: 거래일 형식이 올바르지 않습니다 (YYYY-MM-DD)", "4번째 줄: 구분은 매수/매도여야 합니다"]);
  });

  it("필수 열이 없으면 거부한다", () => {
    expect(fromCsv("계좌,거래일\n일반,2026-01-01").errors[0]).toContain("필수 열이 없습니다");
  });
});
