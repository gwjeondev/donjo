// 수익률 화면의 조회 기간 (1M, 3M, YTD, 1Y, 전체, 직접입력)
import { addDays, type DailyPoint } from "./performance";

export const RANGE_IDS = ["1M", "3M", "YTD", "1Y", "전체", "직접"] as const;
export type RangeId = (typeof RANGE_IDS)[number];

const DAYS: Partial<Record<RangeId, number>> = { "1M": 31, "3M": 92, "1Y": 366 };

/** 고른 기간의 시작일·종료일 (YYYY-MM-DD). last는 데이터의 마지막 날짜 */
export function rangeBounds(id: RangeId, last: string, custom?: { from?: string; to?: string }): { from?: string; to?: string } {
  if (id === "전체") return {};
  if (id === "YTD") return { from: `${last.slice(0, 4)}-01-01` };
  if (id === "직접") {
    const { from, to } = custom ?? {};
    // 거꾸로 입력해도 앞뒤를 맞춘다
    return from && to && from > to ? { from: to, to: from } : { from, to };
  }
  return { from: addDays(last, -DAYS[id]!) };
}

/**
 * 기간 안의 날짜만 남긴다. before는 기간 직전 날(첫날 수익률의 기준점)의 위치로,
 * 첫 구간의 기초 평가금액과 지수 비교의 0% 기준에 쓴다.
 */
export function sliceRange<T extends { date: string }>(points: T[], from?: string, to?: string) {
  const start = from ? points.findIndex((p) => p.date >= from) : 0;
  if (start < 0) return { points: [] as T[], before: undefined as T | undefined };
  let end = points.length;
  if (to) while (end > start && points[end - 1].date > to) end--;
  return { points: points.slice(start, end), before: start > 0 ? points[start - 1] : undefined };
}

export type { DailyPoint };
