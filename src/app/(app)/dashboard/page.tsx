import { AllocationChart } from "@/components/allocation-chart";
import { AssetChart } from "@/components/asset-chart";
import { FxNote } from "@/components/fx-note";
import { Holdings } from "@/components/holdings";
import { PageHeader } from "@/components/page-header";
import { SummaryCards } from "@/components/summary-cards";
import { Welcome } from "@/components/welcome";
import { loadPerformance, loadPortfolio, loadPrefs } from "@/lib/data";
import { cumulative } from "@/lib/performance";
import { cashKrw } from "@/lib/cash";
import { mergeBySymbol } from "@/lib/portfolio";
import { localizeStockNames } from "@/lib/market/service";
import { requireUserId } from "@/lib/session";

export const metadata = { title: "대시보드" };

export default async function DashboardPage() {
  const userId = await requireUserId();
  // 영문 이름으로 저장된 국내 종목은 증권사 표기 한글 이름으로 바꾼다 (실패해도 화면은 그대로 보여 준다)
  await localizeStockNames(userId).catch((e) => console.error("[names] 한글 이름 변환 실패:", e));
  const [{ accounts, trades, positions, summary, dividendKrw, cash, cashByAccount, fx, quotedAt }, perf, prefs] = await Promise.all([
    loadPortfolio(userId),
    loadPerformance(userId),
    loadPrefs(userId),
  ]);
  const held = positions.filter((p) => p.quantity > 0);
  const merged = mergeBySymbol(held);

  const sumBy = (keyOf: (p: (typeof held)[number]) => string, labelOf: (k: string) => string) => {
    const m = new Map<string, number>();
    for (const p of held) m.set(keyOf(p), (m.get(keyOf(p)) ?? 0) + p.valueKrw);
    return [...m].map(([key, value]) => ({ key, label: labelOf(key), value }));
  };
  const accountName = new Map(accounts.map((a) => [a.id, a.name]));
  // 현금 (원화 환산). 비중 차트에 '현금' 조각으로, 자산 추이에 더해서 보여 준다
  const cashTotal = Math.max(cashKrw(cash, fx.rate), 0);
  const cashSlice = cashTotal > 0 ? [{ key: "__cash", label: "현금", value: cashTotal }] : [];
  const cashByAcct = [...cashByAccount].map(([id, b]) => ({ key: id, value: Math.max(cashKrw(b, fx.rate), 0) }));
  const withCash = (slices: { key: string; label: string; value: number }[]) => [...slices, ...cashSlice];
  const assetPoints = cumulative(perf.daily).map((p) => ({ ...p, value: Math.round(p.value + (perf.cashDaily[p.date] ?? 0)) }));

  return (
    <>
      {/* 대시보드는 보기 전용: 기록 추가·수정은 거래내역·계좌 화면에서 */}
      <PageHeader title="전체 자산" sub={<FxNote fx={fx} quotedAt={quotedAt} />} />
      {trades.length === 0 ? (
        <Welcome accounts={accounts} />
      ) : (
        <div className="space-y-4">
          <SummaryCards summary={summary} dividendKrw={dividendKrw} cash={cash} usdKrw={fx.rate} />
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <AssetChart points={assetPoints} failed={perf.failed} withCash={cashTotal > 0 || Object.keys(perf.cashDaily).length > 0} />
            <AllocationChart
              groups={[
                {
                  id: "stock",
                  label: "종목",
                  slices: withCash(merged.map((p) => ({ key: p.symbol, label: p.name, value: p.valueKrw }))),
                },
                {
                  id: "market",
                  label: "시장",
                  // 국내(코스피·코스닥)와 해외 두 묶음
                  slices: withCash(
                    sumBy(
                      (p) => (p.market === "US" ? "US" : "KR"),
                      (k) => (k === "US" ? "해외" : "국내"),
                    ),
                  ),
                },
                {
                  id: "account",
                  label: "계좌",
                  // 계좌별은 그 계좌의 현금까지 더한다
                  slices: (() => {
                    const m = new Map<string, number>();
                    for (const p of held) m.set(p.accountId, (m.get(p.accountId) ?? 0) + p.valueKrw);
                    for (const c of cashByAcct) m.set(c.key, (m.get(c.key) ?? 0) + c.value);
                    return [...m].map(([key, value]) => ({ key, label: accountName.get(key) ?? "", value }));
                  })(),
                },
              ]}
            />
          </div>
          <Holdings positions={merged} totalValue={summary.valueKrw + cashTotal} usdKrw={fx.rate} sort={prefs.holdings} />
        </div>
      )}
    </>
  );
}
