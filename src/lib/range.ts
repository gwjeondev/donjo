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

/** 기본 조회 기간: 짧을수록 계산할 시세가 적어 화면이 빨리 뜬다 */
export const DEFAULT_RANGE: RangeId = "1M";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
/** 주소 → 조회 기간. ?range=1M|3M|YTD|1Y|all|custom&from=&to= (없으면 기본 1M) */
export function parseRange(params: { range?: string; from?: string; to?: string }) {
  const raw = params.range === "custom" ? "직접" : params.range === "all" ? "전체" : params.range;
  const range: RangeId = RANGE_IDS.includes(raw as RangeId) ? (raw as RangeId) : DEFAULT_RANGE;
  const custom = {
    from: params.from && DATE.test(params.from) ? params.from : undefined,
    to: params.to && DATE.test(params.to) ? params.to : undefined,
  };
  return { range, custom };
}

/** 조회 기간 → 주소 쿼리 (기본값은 생략) */
export function rangeQuery(range: RangeId, custom: { from?: string; to?: string }) {
  const q: Record<string, string> = {};
  if (range !== DEFAULT_RANGE) q.range = range === "직접" ? "custom" : range === "전체" ? "all" : range;
  if (range === "직접") {
    if (custom.from) q.from = custom.from;
    if (custom.to) q.to = custom.to;
  }
  return q;
}
