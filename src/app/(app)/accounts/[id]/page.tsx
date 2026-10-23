import Link from "next/link";
import { notFound } from "next/navigation";
import { AccountButton } from "@/components/account-form";
import { CurrencyToggle } from "@/components/currency";
import { Holdings } from "@/components/holdings";
import { PageHeader } from "@/components/page-header";
import { SummaryCards } from "@/components/summary-cards";
import { AddTradeButton } from "@/components/trade-form";
import { TradeList } from "@/components/trade-list";
import { loadPortfolio } from "@/lib/data";
import { requireUserId } from "@/lib/session";

export default async function AccountPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await requireUserId();
  const { accounts, trades, positions, summary, fx } = await loadPortfolio(userId, id);
  const account = accounts.find((a) => a.id === id);
  if (!account) notFound();

  return (
    <>
      <Link href="/accounts" className="text-sm text-ink-2 hover:text-ink">← 계좌 목록</Link>
      <div className="mt-2">
        <PageHeader title={account.name} sub={[account.broker, account.memo].filter(Boolean).join(" · ") || undefined}>
          <AccountButton initial={account} />
          <AddTradeButton accounts={accounts} defaultAccountId={account.id} />
        </PageHeader>
      </div>
      <div className="space-y-5">
        <SummaryCards summary={summary} />
        <Holdings positions={positions} totalValue={summary.valueKrw} usdKrw={fx.rate} />
        <section>
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 className="font-semibold">매매 기록</h2>
            <div className="flex items-center gap-3">
              <Link href={`/performance?account=${account.id}`} className="whitespace-nowrap text-sm text-brand">수익률 보기 →</Link>
              {trades.some((t) => t.market === "US") && <CurrencyToggle />}
            </div>
          </div>
          <TradeList trades={trades} accounts={accounts} showAccount={false} />
        </section>
      </div>
    </>
  );
}
