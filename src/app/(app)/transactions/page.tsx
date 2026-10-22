import { AccountFilter } from "@/components/account-filter";
import { PageHeader } from "@/components/page-header";
import { AddTradeButton } from "@/components/trade-form";
import { TradeList } from "@/components/trade-list";
import { prisma } from "@/lib/db";
import { loadTrades } from "@/lib/data";
import { requireUserId } from "@/lib/session";

export const metadata = { title: "매매기록" };

export default async function TransactionsPage({ searchParams }: { searchParams: Promise<{ account?: string }> }) {
  const { account } = await searchParams;
  const userId = await requireUserId();
  const [accounts, trades] = await Promise.all([
    prisma.account.findMany({ where: { userId }, orderBy: { createdAt: "asc" }, select: { id: true, name: true } }),
    loadTrades(userId, account),
  ]);
  return (
    <>
      <PageHeader title="매매기록" sub={`총 ${trades.length}건`}>
        <AccountFilter accounts={accounts} value={account} />
        <AddTradeButton accounts={accounts} defaultAccountId={account} label="추가" />
      </PageHeader>
      <TradeList trades={trades} accounts={accounts} showAccount={!account} />
    </>
  );
}
