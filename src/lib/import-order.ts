// CSV로 가져온 매매 기록의 "같은 날짜 안" 순서 정하기.
// 증권사 내보내기 파일은 보통 최신 거래가 위에 있어서, 파일 순서대로 처리하면 같은 날의
// 매수보다 매도를 먼저 계산해 "보유 수량보다 많이 매도"가 될 수 있다. 실제로 가능한 순서를 찾는다.
import { findOversell, type Trade } from "./portfolio";

type Row = Omit<Trade, "createdAt">;

function withSequence<T extends Row>(rows: T[], base: number): (T & { createdAt: string })[] {
  // 날짜순으로 정렬하되 같은 날짜 안에서는 주어진 순서를 유지하고, 그 순서를 createdAt으로 남긴다
  return rows
    .map((r, i) => ({ r, i }))
    .sort((a, b) => a.r.tradeDate.localeCompare(b.r.tradeDate) || a.i - b.i)
    .map(({ r }, i) => ({ ...r, createdAt: new Date(base + i).toISOString() }));
}

/**
 * 기존 기록과 합쳐도 보유 수량을 넘는 매도가 없는 순서를 찾는다. 시도하는 순서:
 * 1) 파일이 최신순이면 뒤집은 순서(= 실제 거래 순서), 아니면 파일 순서
 * 2) 그 반대
 * 3) 같은 날에는 매수를 먼저
 * 셋 다 안 되면 null과 함께 문제가 된 매도를 돌려준다.
 */
export function orderImportRows<T extends Row>(
  existing: Trade[],
  rows: T[],
  base = Date.now(),
): { rows: (T & { createdAt: string })[]; oversell: null } | { rows: null; oversell: Trade } {
  const descending = rows.length > 1 && rows[0].tradeDate > rows[rows.length - 1].tradeDate;
  const fileOrder = rows;
  const reversed = [...rows].reverse();
  const buysFirst = [...(descending ? reversed : fileOrder)].sort((a, b) =>
    a.tradeDate === b.tradeDate ? (a.type === b.type ? 0 : a.type === "BUY" ? -1 : 1) : 0,
  );
  const candidates = descending ? [reversed, fileOrder, buysFirst] : [fileOrder, reversed, buysFirst];

  let firstProblem: Trade | null = null;
  for (const candidate of candidates) {
    const ordered = withSequence(candidate, base);
    const problem = findOversell([...existing, ...ordered]);
    if (!problem) return { rows: ordered, oversell: null };
    firstProblem ??= problem;
  }
  return { rows: null, oversell: firstProblem! };
}
