import { describe, expect, it } from "vitest";
import { orderImportRows } from "../import-order";
import { computePositions, type Trade } from "../portfolio";

let n = 0;
const row = (tradeDate: string, type: "BUY" | "SELL", quantity: number, price: number) => ({
  id: `r${++n}`,
  accountId: "toss",
  symbol: "000660.KS",
  name: "SK하이닉스",
  market: "KOSPI" as const,
  type,
  quantity,
  price,
  fee: 0,
  tax: 0,
  fxRate: 1,
  tradeDate,
});

// 토스 거래내역 (최신순으로 내보낸 파일 그대로)
const tossExport = [
  row("2025-10-27", "SELL", 12, 551000),
  row("2025-10-27", "SELL", 6, 546000),
  row("2025-10-27", "BUY", 6, 546000),
  row("2025-10-24", "BUY", 5, 508000),
  row("2025-10-24", "BUY", 1, 509000),
  row("2025-10-23", "BUY", 6, 484500),
];

describe("orderImportRows", () => {
  it("최신순 파일은 뒤집어서 실제 거래 순서로 처리한다", () => {
    const res = orderImportRows([], tossExport, 0);
    expect(res.oversell).toBeNull();
    const ordered = res.rows!;
    expect(ordered.map((r) => `${r.tradeDate} ${r.type} ${r.quantity}`)).toEqual([
      "2025-10-23 BUY 6",
      "2025-10-24 BUY 1",
      "2025-10-24 BUY 5",
      "2025-10-27 BUY 6",
      "2025-10-27 SELL 6",
      "2025-10-27 SELL 12",
    ]);
    // 전량 매도 → 보유 0주, 실현손익 계산됨
    const [p] = computePositions(ordered);
    expect(p.quantity).toBe(0);
    expect(p.realizedPnlKrw).toBeCloseTo(6 * 546000 + 12 * 551000 - (6 * 484500 + 1 * 509000 + 5 * 508000 + 6 * 546000));
  });

  it("오래된 순 파일은 그대로 쓴다", () => {
    const asc = [...tossExport].reverse();
    expect(orderImportRows([], asc, 0).rows!.map((r) => r.id)).toEqual(asc.map((r) => r.id));
  });

  it("어떤 순서로도 안 되면 문제가 된 매도를 알려 준다", () => {
    const res = orderImportRows([], [row("2025-10-27", "SELL", 99, 1), row("2025-10-23", "BUY", 1, 1)], 0);
    expect(res.rows).toBeNull();
    expect(res.oversell?.quantity).toBe(99);
  });

  it("기존 보유분까지 합쳐서 판단한다", () => {
    const existing: Trade[] = [{ ...row("2025-10-01", "BUY", 10, 400000), createdAt: "2025-10-01T00:00:00.000Z" }];
    expect(orderImportRows(existing, [row("2025-10-27", "SELL", 10, 551000)], 0).oversell).toBeNull();
  });
});
