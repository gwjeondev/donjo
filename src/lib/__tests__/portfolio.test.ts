import { describe, expect, it } from "vitest";
import { computePositions, summarize, valuePosition, type Trade } from "../portfolio";
import { aggregate, buildDailySeries, FX_SYMBOL, type PriceSeries } from "../performance";

let seq = 0;
const trade = (t: Partial<Trade>): Trade => ({
  id: String(++seq),
  accountId: "a1",
  symbol: "005930.KS",
  name: "삼성전자",
  market: "KOSPI",
  type: "BUY",
  quantity: 10,
  price: 70000,
  fee: 0,
  tax: 0,
  fxRate: 1,
  tradeDate: "2026-01-05",
  ...t,
});

describe("computePositions", () => {
  it("평균단가로 매수를 합산한다", () => {
    const [p] = computePositions([
      trade({ quantity: 10, price: 70000 }),
      trade({ quantity: 10, price: 80000, tradeDate: "2026-01-06" }),
    ]);
    expect(p.quantity).toBe(20);
    expect(p.avgCost).toBe(75000);
    expect(p.costBasisKrw).toBe(1_500_000);
  });

  it("매도 시 평균단가 기준 실현손익을 계산한다", () => {
    const [p] = computePositions([
      trade({ quantity: 10, price: 70000 }),
      trade({ quantity: 10, price: 80000, tradeDate: "2026-01-06" }),
      trade({ type: "SELL", quantity: 5, price: 90000, fee: 1000, tradeDate: "2026-01-07" }),
    ]);
    expect(p.quantity).toBe(15);
    expect(p.avgCost).toBe(75000);
    expect(p.realizedPnlKrw).toBe(5 * 90000 - 1000 - 5 * 75000);
  });

  it("미국 주식은 거래 시점 환율로 원화 환산한다", () => {
    const [p] = computePositions([
      trade({ symbol: "AAPL", market: "US", quantity: 2, price: 100, fxRate: 1300 }),
      trade({ symbol: "AAPL", market: "US", type: "SELL", quantity: 1, price: 120, fxRate: 1400, tradeDate: "2026-02-01" }),
    ]);
    expect(p.currency).toBe("USD");
    expect(p.realizedPnl).toBe(20);
    expect(p.realizedPnlKrw).toBe(120 * 1400 - 100 * 1300);
    expect(p.costBasisKrw).toBe(130000);
  });

  it("계좌별로 따로 관리한다", () => {
    const ps = computePositions([trade({ accountId: "a1" }), trade({ accountId: "a2" })]);
    expect(ps).toHaveLength(2);
  });

  it("보유 수량보다 많이 매도하면 보유분만 처리한다", () => {
    const [p] = computePositions([
      trade({ quantity: 1 }),
      trade({ type: "SELL", quantity: 5, price: 80000, tradeDate: "2026-01-06" }),
    ]);
    expect(p.quantity).toBe(0);
    expect(p.realizedPnlKrw).toBe(10000);
  });
});

describe("valuation", () => {
  it("현재가와 현재 환율로 평가한다", () => {
    const [p] = computePositions([trade({ symbol: "AAPL", market: "US", quantity: 2, price: 100, fxRate: 1300 })]);
    const v = valuePosition(p, { price: 110, previousClose: 105 }, 1400);
    expect(v.valueKrw).toBe(2 * 110 * 1400);
    expect(v.unrealizedPnlKrw).toBe(308000 - 260000);
    expect(v.dayChangeKrw).toBe(2 * 5 * 1400);
    const s = summarize([v]);
    expect(s.totalPnlKrw).toBe(48000);
  });

  it("시세가 없으면 매입금액으로 평가한다", () => {
    const [p] = computePositions([trade({})]);
    const v = valuePosition(p, undefined, 1400);
    expect(v.valueKrw).toBe(700000);
    expect(v.hasQuote).toBe(false);
  });
});

describe("performance", () => {
  const prices: PriceSeries = new Map([
    [
      "005930.KS",
      new Map([
        ["2026-01-05", 100],
        ["2026-01-06", 110],
        ["2026-01-07", 121],
        ["2026-02-02", 121],
      ]),
    ],
    [FX_SYMBOL, new Map([["2026-01-05", 1300]])],
  ]);

  it("추가 매수는 수익률에 영향을 주지 않는다 (TWR)", () => {
    const pts = buildDailySeries(
      [
        trade({ quantity: 10, price: 100 }),
        trade({ quantity: 10, price: 110, tradeDate: "2026-01-06" }),
      ],
      prices,
      "2026-01-07",
    );
    expect(pts.map((p) => p.value)).toEqual([1000, 2200, 2420]);
    const [jan] = aggregate(pts, "month");
    expect(jan.returnRate).toBeCloseTo((1 + 100 / 2100) * 1.1 - 1);
    expect(jan.netFlow).toBe(2100);
    expect(jan.pnl).toBe(320);
  });

  it("월/년 단위로 묶고 주말은 건너뛴다", () => {
    const pts = buildDailySeries([trade({ quantity: 1, price: 100 })], prices, "2026-02-02");
    expect(pts.some((p) => p.date === "2026-01-10")).toBe(false);
    const months = aggregate(pts, "month");
    expect(months.map((m) => m.period)).toEqual(["2026-01", "2026-02"]);
    expect(months[1].startValue).toBe(121);
    expect(months[1].returnRate).toBeCloseTo(0);
    expect(aggregate(pts, "year")[0].returnRate).toBeCloseTo(0.21);
  });
});

describe("mergeBySymbol", () => {
  it("계좌가 달라도 같은 종목은 합산한다", async () => {
    const { mergeBySymbol } = await import("../portfolio");
    const ps = computePositions([
      trade({ accountId: "a1", quantity: 10, price: 100 }),
      trade({ accountId: "a2", quantity: 10, price: 200 }),
    ]).map((p) => valuePosition(p, { price: 300 }, 1400));
    const [m] = mergeBySymbol(ps);
    expect(m.quantity).toBe(20);
    expect(m.avgCost).toBe(150);
    expect(m.valueKrw).toBe(6000);
    expect(m.returnRate).toBe(1);
  });
});
