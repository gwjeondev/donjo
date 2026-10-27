import { describe, expect, it } from "vitest";
import { dividendNetKrw, incomeByYear, realizedEvents, type Dividend } from "../income";
import { computePositions, type Trade } from "../portfolio";

let seq = 0;
const t = (x: Partial<Trade>): Trade => ({
  id: String(++seq), accountId: "a", symbol: "005930.KS", name: "삼성전자", market: "KOSPI", type: "BUY",
  quantity: 10, price: 1000, fee: 0, tax: 0, fxRate: 1, tradeDate: "2025-01-02", ...x,
});

describe("realizedEvents", () => {
  const trades = [
    t({ quantity: 10, price: 1000, fee: 100 }),
    t({ quantity: 10, price: 2000, tradeDate: "2025-02-01" }),
    t({ type: "SELL", quantity: 5, price: 3000, fee: 10, tax: 20, tradeDate: "2025-03-01" }),
    t({ type: "SELL", quantity: 15, price: 1000, tradeDate: "2026-01-05" }),
    t({ symbol: "AAPL", name: "Apple", market: "US", quantity: 2, price: 100, fxRate: 1300 }),
    t({ symbol: "AAPL", name: "Apple", market: "US", type: "SELL", quantity: 2, price: 110, fxRate: 1400, tradeDate: "2025-06-01" }),
  ];

  it("건별 손익 합계가 보유 현황의 실현손익과 같다", () => {
    const ev = realizedEvents(trades);
    const total = ev.reduce((s, e) => s + e.pnlKrw, 0);
    const pos = computePositions(trades).reduce((s, p) => s + p.realizedPnlKrw, 0);
    expect(total).toBeCloseTo(pos);
    expect(ev).toHaveLength(3);
  });

  it("평균단가와 원화 손익(매수·매도 시점 환율)", () => {
    const [first, apple] = realizedEvents(trades);
    expect(first.avgCost).toBeCloseTo(1500); // 수수료 제외 (10000+20000)/20
    expect(first.pnlKrw).toBeCloseTo(15000 - 30 - 7525);
    expect(apple.pnl).toBeCloseTo(20);
    expect(apple.pnlKrw).toBeCloseTo(220 * 1400 - 200 * 1300);
  });

  it("연도별로 실현손익과 세후 배당을 모은다", () => {
    const divs: Dividend[] = [
      { id: "d1", accountId: "a", symbol: "AAPL", name: "Apple", market: "US", amount: 10, tax: 1.5, fxRate: 1400, payDate: "2025-08-15" },
      { id: "d2", accountId: "a", symbol: "005930.KS", name: "삼성전자", market: "KOSPI", amount: 3610, tax: 550, fxRate: 1, payDate: "2026-04-18" },
    ];
    expect(dividendNetKrw(divs[0])).toBeCloseTo(8.5 * 1400);
    const years = incomeByYear(realizedEvents(trades), divs);
    expect(years.map((y) => y.year)).toEqual(["2026", "2025"]);
    expect(years[0]).toMatchObject({ dividendKrw: 3060, sells: 1 });
    expect(years[1].sells).toBe(2);
  });
});

describe("배당금과 수익률", () => {
  it("배당을 받은 날 손익과 수익률에 들어간다", async () => {
    const { buildDailySeries } = await import("../performance");
    const trades = [t({ quantity: 10, price: 1000, tradeDate: "2025-01-06" })];
    const prices = new Map([["005930.KS", new Map([["2025-01-06", 1000], ["2025-01-07", 1000]])]]);
    const pts = buildDailySeries(trades, prices, "2025-01-07", new Map([["2025-01-07", 500]]));
    expect(pts.at(-1)).toMatchObject({ value: 10000, flow: -500 });
    expect(pts.at(-1)!.ret).toBeCloseTo(0.05);
  });
});

describe("소수점 주식을 다 판 뒤", () => {
  it("계산 찌꺼기 때문에 수익률이 엉뚱한 값이 되지 않는다 (보유 0이면 수익률 0)", async () => {
    const { buildDailySeries } = await import("../performance");
    // 0.1주를 세 번 사서 0.3주를 판다: 부동소수점으로는 0.1+0.1+0.1 − 0.3 = 5.5e-17주가 남는다
    const trades = [
      t({ symbol: "AAPL", market: "US", quantity: 0.1, price: 200, fxRate: 1400, tradeDate: "2025-01-06" }),
      t({ symbol: "AAPL", market: "US", quantity: 0.1, price: 200, fxRate: 1400, tradeDate: "2025-01-06" }),
      t({ symbol: "AAPL", market: "US", quantity: 0.1, price: 200, fxRate: 1400, tradeDate: "2025-01-06" }),
      t({ symbol: "AAPL", market: "US", type: "SELL", quantity: 0.3, price: 210, fxRate: 1400, tradeDate: "2025-01-07" }),
    ];
    const bars = (p: number) => new Map(["2025-01-06", "2025-01-07", "2025-01-08", "2025-01-09", "2025-01-10"].map((d, i) => [d, p + i]));
    const prices = new Map([["AAPL", bars(200)], ["KRW=X", bars(1400)]]);
    const pts = buildDailySeries(trades, prices, "2025-01-10");
    const after = pts.filter((p) => p.date > "2025-01-07");
    expect(after.length).toBeGreaterThan(0);
    for (const p of after) {
      expect(p.value).toBe(0);
      expect(p.ret).toBe(0);
    }
  });
});
