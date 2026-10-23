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
    // 국내 종목은 "국내"로 나가고, 거래소는 가져올 때 다시 찾는다
    expect(csv).toContain(",해외,SNDK,");
    expect(csv).toContain(",국내,005930,");
    expect(rows).toEqual([sample[0], { ...sample[1], market: "KR", symbol: "005930" }]);
  });

  it("시장 칸은 국내/해외·코스피/코스닥/미국을 받고, 비우면 종목코드로 판단한다", () => {
    const csv = "계좌,거래일,구분,시장,종목코드,종목명,수량,단가,환율\n일반,2026-10-01,매수,,005930,삼성전자,1,70000,\n일반,2026-10-01,매수,,AAPL,애플,1,200,1400\n일반,2026-10-01,매수,코스닥,035720.KQ,카카오,1,50000,\n일반,2026-10-01,매수,미국,TSLA,테슬라,1,300,\n일반,2026-10-01,매수,일본,7203,도요타,1,1,";
    const { rows, errors } = fromCsv(csv);
    expect(rows.map((r) => [r.market, r.symbol])).toEqual([["KR", "005930"], ["US", "AAPL"], ["KOSDAQ", "035720"], ["US", "TSLA"]]);
    expect(errors).toEqual(["6번째 줄: 시장은 국내/해외로 적어 주세요 (비우면 종목코드로 판단해요)"]);
  });

  it("시장 열이 없어도 읽는다", () => {
    const { rows, errors } = fromCsv("계좌,거래일,구분,종목코드,종목명,수량,단가\n일반,2026-10-01,매수,000660,SK하이닉스,1,1");
    expect(errors).toEqual([]);
    expect(rows[0]).toMatchObject({ market: "KR", fxRate: 1 });
  });

  it("따옴표 안의 쉼표와 줄바꿈을 처리한다", () => {
    expect(parseCsv('a,"b,c","d\n""e"""\r\n1,2,3')).toEqual([["a", "b,c", 'd\n"e"'], ["1", "2", "3"]]);
  });

  it("잘못된 줄은 줄 번호와 함께 알려 준다", () => {
    const csv = "계좌,거래일,구분,시장,종목코드,종목명,수량,단가\n일반,2026/10/01,매수,코스피,005930,삼성전자,\"1,000\",70000\n일반,어제,매수,코스피,005930,삼성전자,1,1\n일반,2026-10-01,보유,코스피,005930,삼성전자,1,1";
    const { rows, errors } = fromCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ tradeDate: "2026-10-01", quantity: 1000, fxRate: 1 });
    expect(errors).toEqual(["3번째 줄: 거래일 형식이 올바르지 않아요 (YYYY-MM-DD)", "4번째 줄: 구분은 매수/매도여야 해요"]);
  });

  it("필수 열이 없으면 거부한다", () => {
    expect(fromCsv("계좌,거래일\n일반,2026-01-01").errors[0]).toContain("필수 열이 없어요");
  });
});
