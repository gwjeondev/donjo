// 해외주식 양도소득세 추정. 해외 상장 주식(market US)만 대상이다.
// - 과세표준 = 연간 양도차익 합계(손익 통산) − 기본공제 250만 원, 세율 22% (양도소득세 20% + 지방소득세 2%)
// - 취득가액은 화면에서는 이동평균(증권사 계산·실현손익과 같은 기준, 국세청 예규상 계속 적용 시 인정). 선입선출도 계산할 수 있다
// - 원화 환산은 매수·매도 기록의 환율을 쓴다 (실제 신고는 결제일 환율이라 조금 다를 수 있다)
// 국내 상장 해외 ETF(예: KODEX 미국나스닥100)의 매매차익은 양도세가 아니라 배당소득세 대상이라 여기서 빼고,
// 국내 주식은 대주주가 아니면 양도세가 없다.
import { sortTrades, type Trade } from "./portfolio";

export const OVERSEAS_DEDUCTION = 2_500_000;
export const OVERSEAS_TAX_RATE = 0.22;

export type CostMethod = "fifo" | "avg";

export interface TaxableSale {
  tradeId: string;
  accountId: string;
  symbol: string;
  name: string;
  date: string;
  quantity: number;
  /** 매도 대금 − 매도 수수료·세금 (원화, 매도 환율) */
  proceedsKrw: number;
  /** 판 수량의 취득가액 + 매수 수수료 (원화, 매수 환율) */
  costKrw: number;
  gainKrw: number;
}

interface Lot {
  qty: number;
  /** 1주당 원화 취득가 (매수 수수료 포함) */
  unitKrw: number;
}

/** year년에 판 해외주식의 건별 양도차익 */
export function overseasSales(trades: Trade[], year: string, method: CostMethod = "fifo"): TaxableSale[] {
  const lots = new Map<string, Lot[]>();
  const sales: TaxableSale[] = [];
  for (const t of sortTrades(trades.filter((x) => x.market === "US"))) {
    if (t.tradeDate.slice(0, 4) > year) break;
    const k = `${t.accountId}|${t.symbol}`;
    const queue = lots.get(k) ?? [];
    lots.set(k, queue);
    if (t.type === "BUY") {
      const totalKrw = (t.quantity * t.price + t.fee + t.tax) * t.fxRate;
      if (method === "avg" && queue.length) {
        // 이동평균: 보유분을 한 덩어리로 합친다
        const held = queue[0];
        const qty = held.qty + t.quantity;
        queue[0] = { qty, unitKrw: (held.qty * held.unitKrw + totalKrw) / qty };
      } else {
        queue.push({ qty: t.quantity, unitKrw: totalKrw / t.quantity });
      }
      continue;
    }
    // 매도: 먼저 산 것부터 (이동평균이면 덩어리 하나)
    let left = Math.min(t.quantity, queue.reduce((s, l) => s + l.qty, 0));
    if (left <= 0) continue;
    const sold = left;
    let costKrw = 0;
    while (left > 1e-9 && queue.length) {
      const lot = queue[0];
      const take = Math.min(lot.qty, left);
      costKrw += take * lot.unitKrw;
      lot.qty -= take;
      left -= take;
      if (lot.qty <= 1e-9) queue.shift();
    }
    if (t.tradeDate.slice(0, 4) !== year) continue;
    const proceedsKrw = (sold * t.price - t.fee - t.tax) * t.fxRate;
    sales.push({
      tradeId: t.id,
      accountId: t.accountId,
      symbol: t.symbol,
      name: t.name,
      date: t.tradeDate,
      quantity: sold,
      proceedsKrw,
      costKrw,
      gainKrw: proceedsKrw - costKrw,
    });
  }
  return sales;
}

/** 연간 양도소득세 추정 (손익 통산 → 기본공제 → 22%) */
export function overseasTax(sales: TaxableSale[]) {
  const gainKrw = sales.reduce((s, x) => s + x.gainKrw, 0);
  const taxableKrw = Math.max(gainKrw - OVERSEAS_DEDUCTION, 0);
  return {
    gainKrw,
    profitKrw: sales.filter((s) => s.gainKrw > 0).reduce((s, x) => s + x.gainKrw, 0),
    lossKrw: sales.filter((s) => s.gainKrw < 0).reduce((s, x) => s + x.gainKrw, 0),
    deductionKrw: Math.min(Math.max(gainKrw, 0), OVERSEAS_DEDUCTION),
    taxableKrw,
    // 10원 미만 절사 대신 원 단위 반올림 (추정치)
    taxKrw: Math.round(taxableKrw * OVERSEAS_TAX_RATE),
    /** 공제까지 남은 금액 (아직 공제 한도 안이면) */
    roomKrw: Math.max(OVERSEAS_DEDUCTION - gainKrw, 0),
  };
}
