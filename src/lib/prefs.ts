// 사용자 화면 설정 (User.prefs). 지금은 목록 정렬 기준만 담는다.
// 설정 화면에서 정한 값이 각 목록의 기본 정렬이 되고, 목록 위에서 바꾼 정렬은 그 화면에서만 쓴다.

export type SortDir = "desc" | "asc";

/** 계좌 목록 정렬 기준 */
export const ACCOUNT_SORTS = {
  created: "만든 순",
  value: "평가금액",
  returnRate: "수익률",
  pnl: "평가손익",
  realized: "실현손익",
  name: "이름",
} as const;
export type AccountSortKey = keyof typeof ACCOUNT_SORTS;

/** 보유종목 정렬 기준 (종목 화면·계좌 상세 공통) */
export const HOLDING_SORTS = {
  value: "평가금액",
  returnRate: "수익률",
  pnl: "평가손익",
  realized: "실현손익",
  dayChange: "오늘 등락",
  name: "이름",
} as const;
export type HoldingSortKey = keyof typeof HOLDING_SORTS;

export interface Sort<K extends string> {
  key: K;
  dir: SortDir;
}

export interface Prefs {
  accounts: Sort<AccountSortKey>;
  holdings: Sort<HoldingSortKey>;
  /** 매매기록: 최신순(new) / 오래된순(old) */
  trades: "new" | "old";
  /** 현금: 입출금만(manual) / 매매·배당도 반영(linked) */
  cash: "manual" | "linked";
}

export const DEFAULT_PREFS: Prefs = {
  // 지금까지의 동작과 같게: 계좌는 만든 순(오래된 것이 위), 보유종목은 평가금액 큰 순, 매매기록은 최신순
  accounts: { key: "created", dir: "asc" },
  holdings: { key: "value", dir: "desc" },
  trades: "new",
  cash: "manual",
};

const isDir = (v: unknown): v is SortDir => v === "asc" || v === "desc";

function readSort<K extends string>(v: unknown, keys: Record<K, string>, fallback: Sort<K>): Sort<K> {
  const o = (v ?? {}) as { key?: unknown; dir?: unknown };
  return {
    key: typeof o.key === "string" && o.key in keys ? (o.key as K) : fallback.key,
    dir: isDir(o.dir) ? o.dir : fallback.dir,
  };
}

/** DB의 JSON(형식이 틀렸거나 비어 있어도)을 안전하게 읽는다 */
export function readPrefs(raw: unknown): Prefs {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    accounts: readSort(o.accounts, ACCOUNT_SORTS, DEFAULT_PREFS.accounts),
    holdings: readSort(o.holdings, HOLDING_SORTS, DEFAULT_PREFS.holdings),
    trades: o.trades === "old" ? "old" : "new",
    cash: o.cash === "linked" ? "linked" : "manual",
  };
}

/**
 * 정렬 기준값을 꺼내는 함수로 정렬한다. 문자열은 한글 순서로, 같으면 원래 순서를 유지한다.
 * 이름은 가나다순이 자연스러우므로 desc라도 '높은 순'이 아니라 반대 방향(하→가)으로 본다.
 */
export function sortBy<T>(items: T[], value: (item: T) => number | string, dir: SortDir): T[] {
  const sign = dir === "asc" ? 1 : -1;
  return items
    .map((item, i) => ({ item, i, v: value(item) }))
    .sort((a, b) => {
      const c =
        typeof a.v === "string" || typeof b.v === "string"
          ? String(a.v).localeCompare(String(b.v), "ko")
          : (a.v as number) - (b.v as number);
      return c * sign || a.i - b.i;
    })
    .map((x) => x.item);
}

/** 정렬 방향 이름: 이름·만든 순은 오름/내림, 숫자는 높은/낮은 순 */
export function dirLabel(key: string, dir: SortDir) {
  if (key === "name") return dir === "asc" ? "가나다순" : "역순";
  if (key === "created") return dir === "asc" ? "오래된 순" : "최근 순";
  return dir === "desc" ? "높은 순" : "낮은 순";
}
