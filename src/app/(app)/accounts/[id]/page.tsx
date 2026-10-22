import Link from "next/link";
import { notFound } from "next/navigation";
import { AccountButton } from "@/components/account-form";
import { DeleteAccountButton } from "@/components/delete-account";
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
  const { accounts, trades, positions, summary } = await loadPortfolio(userId, id);
  const account = accounts.find((a) => a.id === id);
  if (!account) notFound();

  return (
    <>
      <Link href="/accounts" className="text-sm text-ink-2 hover:text-ink">← 계좌 목록</Link>
      <div className="mt-2">
        <PageHeader title={account.name} sub={[account.broker, account.memo].filter(Boolean).join(" · ") || undefined}>
          <DeleteAccountButton id={account.id} name={account.name} />
          <AccountButton initial={account} />
          <AddTradeButton accounts={accounts} defaultAccountId={account.id} />
        </PageHeader>
      </div>
      <div className="space-y-5">
        <SummaryCards summary={summary} />
        <section>
          <h2 className="mb-2 font-semibold">보유 종목</h2>
          <Holdings positions={positions} totalValue={summary.valueKrw} />
        </section>
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-semibold">매매 기록</h2>
            <Link href={`/performance?account=${account.id}`} className="text-sm text-brand">이 계좌 수익률 보기 →</Link>
          </div>
          <TradeList trades={trades} accounts={accounts} showAccount={false} />
        </section>
      </div>
    </>
  );
}
