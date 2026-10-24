import Link from "next/link";
import { notFound } from "next/navigation";
import { AccountButton } from "@/components/account-form";
import { CurrencyToggle } from "@/components/currency";
import { Holdings } from "@/components/holdings";
import { PageHeader } from "@/components/page-header";
import { SummaryCards } from "@/components/summary-cards";
import { AddRecordButton } from "@/components/add-record";
import { TradeList } from "@/components/trade-list";
import { dividendStocks, loadCashFlows, loadDividends, loadPortfolio, loadPrefs } from "@/lib/data";
import { requireUserId } from "@/lib/session";

export default async function AccountPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await requireUserId();
  const [{ accounts, trades, positions, summary, dividendKrw, cashByAccount, fx }, prefs, dividends, cashFlows] = await Promise.all([
    loadPortfolio(userId, id),
    loadPrefs(userId),
    loadDividends(userId, id),
    loadCashFlows(userId, id),
  ]);
  const account = accounts.find((a) => a.id === id);
  if (!account) notFound();

  return (
    <>
      <Link href="/accounts" className="text-sm text-ink-2 hover:text-ink">← 계좌 목록</Link>
      <div className="mt-2">
        <PageHeader title={account.name} sub={[account.broker, account.memo].filter(Boolean).join(" · ") || undefined}>
          <AccountButton initial={account} />
          <AddRecordButton accounts={accounts} stocks={dividendStocks(trades)} defaultAccountId={account.id} />
        </PageHeader>
      </div>
      <div className="space-y-5">
        <SummaryCards summary={summary} dividendKrw={dividendKrw} cash={cashByAccount.get(id)} usdKrw={fx.rate} />
        <Holdings positions={positions} totalValue={summary.valueKrw} usdKrw={fx.rate} sort={prefs.holdings} />
        <section>
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 className="shrink-0 whitespace-nowrap font-semibold">거래 내역</h2>
            <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
              <Link href={`/performance?account=${account.id}`} className="whitespace-nowrap text-sm text-brand">수익률 보기 →</Link>
              {trades.some((t) => t.market === "US") && <CurrencyToggle />}
            </div>
          </div>
          <TradeList
            trades={prefs.trades === "old" ? [...trades].reverse() : trades}
            dividends={dividends}
            cashFlows={cashFlows}
            stocks={dividendStocks(trades)}
            order={prefs.trades}
            accounts={accounts}
            showAccount={false}
          />
        </section>
      </div>
    </>
  );
}
