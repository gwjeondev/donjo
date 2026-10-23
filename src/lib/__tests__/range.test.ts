import { describe, expect, it } from "vitest";
import { aggregate, type DailyPoint } from "../performance";
import { rangeBounds, sliceRange } from "../range";

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
