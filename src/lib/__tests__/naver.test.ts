import { describe, expect, it } from "vitest";
import { parseBasic, parseName, parseSearch } from "../market/naver";

describe("naver parsing", () => {
  it("자동완성에서 국내 주식·ETF만 골라 시장을 판별한다", () => {
    const json = {
      query: "필라",
      items: [
        { code: "381180", name: "TIGER 미국필라델피아반도체나스닥", typeCode: "KOSPI", typeName: "코스피", nationCode: "KOR", category: "stock" },
        { code: "247540", name: "에코프로비엠", typeCode: "KOSDAQ", typeName: "코스닥", nationCode: "KOR", category: "stock" },
        { code: "0193T0", name: "TIME 글로벌AI인공지능액티브", typeName: "코스피", nationCode: "KOR" },
        { code: "KOSPI", name: "코스피", category: "index", nationCode: "KOR" },
        { code: "KOSPI", name: "코스피", category: "index" },
      ],
    };
    expect(parseSearch(json)).toEqual([
      { symbol: "381180.KS", name: "TIGER 미국필라델피아반도체나스닥", market: "KOSPI", exchange: "KOSPI" },
      { symbol: "247540.KQ", name: "에코프로비엠", market: "KOSDAQ", exchange: "KOSDAQ" },
      { symbol: "0193T0.KS", name: "TIME 글로벌AI인공지능액티브", market: "KOSPI", exchange: "KOSPI" },
    ]);
  });

  it("미국 종목은 한글 이름으로 찾고 Yahoo 티커로 바꾼다", () => {
    const json = {
      items: [
        { code: "GOOGL", name: "알파벳 A", typeCode: "NASDAQ", typeName: "나스닥", nationCode: "USA", reutersCode: "GOOGL.O", category: "stock" },
        { code: "BRK.B", name: "버크셔 해서웨이 B", typeCode: "NYSE", nationCode: "USA", reutersCode: "BRK.B", category: "stock" },
        { name: "애플", typeName: "나스닥", reutersCode: "AAPL.O" },
        { code: "005930", name: "삼성전자", typeCode: "KOSPI", nationCode: "KOR", category: "stock" },
      ],
    };
    expect(parseSearch(json)).toEqual([
      { symbol: "GOOGL", name: "알파벳 A", market: "US", exchange: "NASDAQ" },
      { symbol: "BRK-B", name: "버크셔 해서웨이 B", market: "US", exchange: "NYSE" },
      { symbol: "AAPL", name: "애플", market: "US", exchange: "US" },
      { symbol: "005930.KS", name: "삼성전자", market: "KOSPI", exchange: "KOSPI" },
    ]);
  });

  it("형식이 달라도 깨지지 않는다", () => {
    expect(parseSearch(null)).toEqual([]);
    expect(parseSearch({ items: [[{ code: "005930", name: "삼성전자", typeName: "코스피" }]] })[0].name).toBe("삼성전자");
    expect(parseSearch({ items: "oops" })).toEqual([]);
  });

  it("기본정보에서 한글 이름을 읽는다", () => {
    expect(parseName({ itemCode: "005930", stockName: "삼성전자", stockNameEng: "Samsung Elec" })).toBe("삼성전자");
    expect(parseName({ stockItem: { stockName: "NAVER" } })).toBe("NAVER");
    expect(parseName({})).toBeNull();
  });

  it("기본정보에서 시장을 판별한다", () => {
    expect(parseBasic({ stockName: "에코프로비엠", stockExchangeType: { code: "KQ", nameKor: "코스닥" } })).toEqual({ name: "에코프로비엠", market: "KOSDAQ" });
    expect(parseBasic({ stockName: "삼성전자", stockExchangeType: { code: "KS", nameKor: "코스피" } })).toEqual({ name: "삼성전자", market: "KOSPI" });
    expect(parseBasic({ stockName: "알수없음" })).toEqual({ name: "알수없음", market: null });
    expect(parseBasic({})).toBeNull();
  });
});
