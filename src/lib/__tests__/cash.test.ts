import { describe, expect, it } from "vitest";
import { cashBalances, cashTimeline, type CashFlow } from "../cash";
import type { Dividend } from "../income";
import type { Trade } from "../portfolio";

let n = 0;
const flow = (x: Partial<CashFlow>): CashFlow => ({ id: String(++n), accountId: "a", type: "DEPOSIT", currency: "KRW", amount: 0, fxRate: 1, date: "2026-01-02", ...x });
const trade = (x: Partial<Trade>): Trade => ({
  id: String(++n), accountId: "a", symbol: "005930.KS", name: "삼성전자", market: "KOSPI", type: "BUY",
  quantity: 1, price: 1000, fee: 0, tax: 0, fxRate: 1, tradeDate: "2026-01-03", ...x,
});

describe("현금 잔고", () => {
  const flows = [flow({ amount: 3_000_000 }), flow({ type: "WITHDRAW", amount: 100_000, date: "2026-02-01" })];
  const trades = [
    trade({ quantity: 10, price: 70_000, fee: 100 }),
    trade({ symbol: "AAPL", market: "US", quantity: 5, price: 200, fxRate: 1400, tradeDate: "2026-01-05" }),
    trade({ symbol: "AAPL", market: "US", type: "SELL", quantity: 2, price: 210, fee: 1, fxRate: 1450, tradeDate: "2026-01-10" }),
  ];
  const divs: Dividend[] = [{ id: "d", accountId: "a", symbol: "AAPL", name: "Apple", market: "US", amount: 1, tax: 0.15, fxRate: 1450, payDate: "2026-01-20" }];

  it("따로 관리: 입출금만", () => {
    expect(cashBalances(flows, trades, divs, "manual").get("a")).toEqual({ krw: 2_900_000, usd: 0 });
  });

  it("자동 반영: 국내 주식은 원화, 미국 주식은 달러로만 사고판다 (달러가 모자라면 마이너스)", () => {
    const b = cashBalances(flows, trades, divs, "linked").get("a")!;
    expect(b.krw).toBeCloseTo(3_000_000 - 700_100 - 100_000);
    expect(b.usd).toBeCloseTo(-1000 + 419 + 0.85);
  });

  it("환전한 달러로 미국 주식을 산다", () => {
    const f = [flow({ amount: 1_000_000 }), flow({ type: "EXCHANGE", amount: 280_000, fxRate: 1400 })];
    const t = [trade({ symbol: "AAPL", market: "US", quantity: 1, price: 150, fxRate: 1400 })];
    const b = cashBalances(f, t, [], "linked").get("a")!;
    expect(b.usd).toBeCloseTo(50);
    expect(b.krw).toBeCloseTo(720_000);
  });

  it("날짜별 잔고", () => {
    const tl = cashTimeline(flows, trades, divs, "manual");
    expect(tl).toEqual([{ date: "2026-01-02", krw: 3_000_000, usd: 0 }, { date: "2026-02-01", krw: 2_900_000, usd: 0 }]);
  });
});
