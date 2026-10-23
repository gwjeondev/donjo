import { AllocationChart } from "@/components/allocation-chart";
import { AssetChart } from "@/components/asset-chart";
import { FxNote } from "@/components/fx-note";
import { Holdings } from "@/components/holdings";
import { PageHeader } from "@/components/page-header";
import { SummaryCards } from "@/components/summary-cards";
import { AddTradeButton } from "@/components/trade-form";
import { loadPerformance, loadPortfolio } from "@/lib/data";
import { MARKET_LABEL } from "@/lib/format";
import { cumulative } from "@/lib/performance";
import { mergeBySymbol } from "@/lib/portfolio";
import { requireUserId } from "@/lib/session";

export const metadata = { title: "대시보드" };

export default async function DashboardPage() {
  const userId = await requireUserId();
  const [{ accounts, positions, summary, fx }, perf] = await Promise.all([
    loadPortfolio(userId),
    loadPerformance(userId),
  ]);
  const held = positions.filter((p) => p.quantity > 0);
  const merged = mergeBySymbol(held);

  const sumBy = (keyOf: (p: (typeof held)[number]) => string, labelOf: (k: string) => string) => {
    const m = new Map<string, number>();
    for (const p of held) m.set(keyOf(p), (m.get(keyOf(p)) ?? 0) + p.valueKrw);
    return [...m].map(([key, value]) => ({ key, label: labelOf(key), value }));
  };
  const accountName = new Map(accounts.map((a) => [a.id, a.name]));

  return (
    <>
      <PageHeader title="전체 자산" sub={<FxNote fx={fx} />}>
        <AddTradeButton accounts={accounts} />
      </PageHeader>
      <div className="space-y-4">
        <SummaryCards summary={summary} />
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <AssetChart points={cumulative(perf.daily)} failed={perf.failed} />
          <AllocationChart
            groups={[
              { id: "stock", label: "종목", slices: merged.map((p) => ({ key: p.symbol, label: p.name, value: p.valueKrw })) },
              { id: "market", label: "시장", slices: sumBy((p) => p.market, (k) => MARKET_LABEL[k as keyof typeof MARKET_LABEL]) },
              { id: "account", label: "계좌", slices: sumBy((p) => p.accountId, (k) => accountName.get(k) ?? "") },
            ]}
          />
        </div>
        <Holdings positions={merged} totalValue={summary.valueKrw} usdKrw={fx.rate} />
      </div>
    </>
  );
}
