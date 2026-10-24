import { describe, expect, it } from "vitest";
import type { Trade } from "../portfolio";
import { overseasSales, overseasTax } from "../tax";

let n = 0;
const t = (x: Partial<Trade>): Trade => ({
  id: String(++n), accountId: "a", symbol: "AAPL", name: "Apple", market: "US", type: "BUY",
  quantity: 1, price: 100, fee: 0, tax: 0, fxRate: 1000, tradeDate: "2025-01-02", ...x,
});

describe("해외주식 양도소득세", () => {
  const trades = [
    t({ quantity: 10, price: 100, fxRate: 1000 }), // 1주 10만원
    t({ quantity: 10, price: 200, fxRate: 1000, tradeDate: "2025-06-02" }), // 1주 20만원
    t({ type: "SELL", quantity: 10, price: 300, fee: 1, fxRate: 1400, tradeDate: "2026-02-02" }),
    t({ symbol: "005930.KS", market: "KOSPI", type: "SELL", quantity: 1, price: 1, fxRate: 1, tradeDate: "2026-03-02" }),
  ];

  it("선입선출: 먼저 산 10주가 팔린다, 국내 종목은 제외", () => {
    const [s, ...rest] = overseasSales(trades, "2026");
    expect(rest).toHaveLength(0);
    expect(s.costKrw).toBe(1_000_000);
    expect(s.proceedsKrw).toBe((3000 - 1) * 1400);
    expect(s.gainKrw).toBe(3_198_600);
  });

  it("이동평균: 평균 15만원으로 계산", () => {
    expect(overseasSales(trades, "2026", "avg")[0].costKrw).toBeCloseTo(1_500_000);
  });

  it("기본공제 250만원 뒤 22%, 손실은 통산", () => {
    const sales = overseasSales(trades, "2026");
    const tax = overseasTax(sales);
    expect(tax.taxableKrw).toBe(698_600);
    expect(tax.taxKrw).toBe(Math.round(698_600 * 0.22));
    expect(overseasTax([{ ...sales[0], gainKrw: 1_000_000 }, { ...sales[0], gainKrw: -400_000 }])).toMatchObject({
      gainKrw: 600_000, taxKrw: 0, roomKrw: 1_900_000,
    });
  });

  it("다른 해에 판 것은 들어가지 않는다", () => {
    expect(overseasSales(trades, "2025")).toEqual([]);
  });
});
