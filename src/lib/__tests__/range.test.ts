import { describe, expect, it } from "vitest";
import { aggregate, type DailyPoint } from "../performance";
import { rangeBounds, sliceRange } from "../range";
import { addDays } from "../performance";

const pts: DailyPoint[] = [
  { date: "2025-12-30", value: 100, flow: 100, ret: 0 },
  { date: "2025-12-31", value: 110, flow: 0, ret: 0.1 },
  { date: "2026-01-02", value: 121, flow: 0, ret: 0.1 },
  { date: "2026-01-05", value: 221, flow: 100, ret: 0 },
  { date: "2026-02-02", value: 243.1, flow: 0, ret: 0.1 },
];

describe("range", () => {
  it("YTD는 마지막 날짜가 속한 해의 1월 1일부터", () => {
    expect(rangeBounds("YTD", "2026-10-23")).toEqual({ from: "2026-01-01" });
    expect(rangeBounds("1M", "2026-10-23")).toEqual({ from: "2026-09-22" });
    expect(rangeBounds("전체", "2026-10-23")).toEqual({});
  });

  it("직접입력은 거꾸로 넣어도 앞뒤를 맞춘다", () => {
    expect(rangeBounds("직접", "2026-10-23", { from: "2026-05-01", to: "2026-02-01" })).toEqual({ from: "2026-02-01", to: "2026-05-01" });
    expect(rangeBounds("직접", "2026-10-23", { from: "2026-02-01" })).toEqual({ from: "2026-02-01", to: undefined });
  });

  it("기간으로 자르고 직전 날을 기준점으로 남긴다", () => {
    const { points, before } = sliceRange(pts, "2026-01-01", "2026-01-31");
    expect(points.map((p) => p.date)).toEqual(["2026-01-02", "2026-01-05"]);
    expect(before?.date).toBe("2025-12-31");
    expect(sliceRange(pts, "2027-01-01").points).toEqual([]);
  });

  it("잘라낸 기간의 첫 구간은 직전 평가금액에서 시작한다", () => {
    const { points, before } = sliceRange(pts, "2026-01-01");
    const [jan, feb] = aggregate(points, "month", before?.value);
    expect(jan).toMatchObject({ period: "2026-01", startValue: 110, endValue: 221, netFlow: 100 });
    expect(jan.pnl).toBeCloseTo(11);
    expect(jan.returnRate).toBeCloseTo(0.1);
    expect(feb.returnRate).toBeCloseTo(0.1);
  });
});

describe("짧은 기간만 계산", async () => {
  const { buildDailySeries } = await import("../performance");
  const trade = (x: object) => ({ id: Math.random().toString(), accountId: "a", symbol: "A", name: "A", market: "KOSPI" as const, type: "BUY" as const, quantity: 10, price: 100, fee: 0, tax: 0, fxRate: 1, tradeDate: "2026-01-05", ...x });
  const trades = [trade({}), trade({ tradeDate: "2026-03-02", quantity: 5, price: 120 })];
  const closes = new Map<string, number>();
  for (let d = "2026-01-05"; d <= "2026-03-20"; d = addDays(d, 1)) closes.set(d, 100 + Number(d.slice(8)) + Number(d.slice(5, 7)) * 10);
  const prices = new Map([["A", closes]]);
  it("시작일부터만 계산해도 그 기간의 값과 수익률은 전체 계산과 같다", () => {
    const full = buildDailySeries(trades, prices, "2026-03-20");
    const part = buildDailySeries(trades, prices, "2026-03-20", new Map(), "2026-02-20");
    expect(part[0].date >= "2026-02-20").toBe(true);
    const tail = (pts: typeof full) => pts.filter((p) => p.date >= "2026-02-23");
    expect(tail(part).map((p) => [p.date, p.value, p.flow])).toEqual(tail(full).map((p) => [p.date, p.value, p.flow]));
    tail(part).forEach((p, i) => expect(p.ret).toBeCloseTo(tail(full)[i].ret));
  });
});
