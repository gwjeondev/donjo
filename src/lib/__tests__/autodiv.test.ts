import { describe, expect, it } from "vitest";
import { computeAutoDividends, estimatePayDate, withholding } from "../autodiv";
import type { Trade } from "../portfolio";

let n = 0;
const trade = (x: Partial<Trade>): Trade => ({
  id: String(++n), accountId: "a", symbol: "005930.KS", name: "삼성전자", market: "KOSPI", type: "BUY",
  quantity: 10, price: 70000, fee: 0, tax: 0, fxRate: 1, tradeDate: "2026-01-05", ...x,
});

describe("자동 배당", () => {
  it("배당락일 전날까지 보유한 수량으로 계산한다 (배당락일 매수분은 제외)", () => {
    const trades = [trade({}), trade({ quantity: 5, tradeDate: "2026-03-27" }), trade({ type: "SELL", quantity: 3, tradeDate: "2026-06-26" })];
    const events = new Map([["005930.KS", [{ exDate: "2026-03-27", amount: 361 }, { exDate: "2026-06-27", amount: 361 }]]]);
    const r = computeAutoDividends({ trades, events, kinds: new Map([["a", "GENERAL"]]), fxOn: () => 1400, today: "2026-10-01" });
    expect(r.map((d) => [d.exDate, d.amount, d.payDate])).toEqual([
      ["2026-03-27", 3610, "2026-04-26"],
      ["2026-06-27", 12 * 361, "2026-07-27"],
    ]);
    expect(r[0].tax).toBe(500 + 50);
  });

  it("다 판 뒤의 배당, 아직 지급일이 안 된 배당은 만들지 않는다", () => {
    const trades = [trade({ tradeDate: "2026-01-05" }), trade({ type: "SELL", tradeDate: "2026-02-01" })];
    const events = new Map([["005930.KS", [{ exDate: "2026-03-27", amount: 361 }]]]);
    expect(computeAutoDividends({ trades, events, kinds: new Map(), fxOn: () => 1, today: "2026-12-31" })).toEqual([]);
    const held = [trade({})];
    expect(computeAutoDividends({ trades: held, events, kinds: new Map(), fxOn: () => 1, today: "2026-04-01" })).toEqual([]);
  });

  it("미국 주식은 달러, 15% 원천징수, 지급일 환율", () => {
    const trades = [trade({ symbol: "AAPL", name: "Apple Inc.", market: "US", quantity: 4, price: 200, fxRate: 1400 })];
    const events = new Map([["AAPL", [{ exDate: "2026-02-09", amount: 0.26 }]]]);
    const [d] = computeAutoDividends({ trades, events, kinds: new Map([["a", "ISA"]]), fxOn: (date) => (date === "2026-02-23" ? 1450 : null), today: "2026-10-01" });
    expect(d).toMatchObject({ amount: 1.04, tax: 0.16, fxRate: 1450, payDate: "2026-02-23" });
  });

  it("세금: ISA·연금 국내 배당은 0, 지급일 추정", () => {
    expect(withholding("PENSION", "KOSPI", 10000)).toBe(0);
    expect(withholding("GENERAL", "KOSPI", 10000)).toBe(1540);
    expect(estimatePayDate("KOSPI", "KODEX 미국나스닥100", "2026-04-29")).toBe("2026-05-03");
    expect(estimatePayDate("KOSPI", "삼성전자", "2025-12-29")).toBe("2026-04-20");
  });
});
