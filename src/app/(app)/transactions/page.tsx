import { AccountFilter } from "@/components/account-filter";
import { CurrencyToggle } from "@/components/currency";
import { MarketFilter, type MarketGroup } from "@/components/market-filter";
import { ExportButton, ImportButton } from "@/components/csv-actions";
import { PageHeader } from "@/components/page-header";
import { AddTradeButton } from "@/components/trade-form";
import { TradeList } from "@/components/trade-list";
import { prisma } from "@/lib/db";
import { loadTrades } from "@/lib/data";
import { requireUserId } from "@/lib/session";

export const metadata = { title: "매매기록" };

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ account?: string; market?: string }>;
}) {
  const params = await searchParams;
  const account = params.account;
  const market: MarketGroup | undefined = params.market === "kr" || params.market === "us" ? params.market : undefined;
  const userId = await requireUserId();
  const [accounts, allTrades] = await Promise.all([
    prisma.account.findMany({ where: { userId }, orderBy: { createdAt: "asc" }, select: { id: true, name: true } }),
    loadTrades(userId, account),
  ]);
  // 국내(코스피·코스닥) / 해외(미국) 구분
  const trades = market
    ? allTrades.filter((t) => (market === "us" ? t.market === "US" : t.market !== "US"))
    : allTrades;
  return (
    <>
      <PageHeader
        title="매매기록"
        sub={`총 ${trades.length}건`}
        toolbar={
          <>
            {/* 왼쪽: 무엇을 볼지(필터), 오른쪽: 어떻게 볼지(통화). 좁으면 통화가 다음 줄 오른쪽으로 */}
            <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto sm:flex-1">
              <AccountFilter accounts={accounts} value={account} />
              <MarketFilter value={market} />
            </div>
            {trades.some((t) => t.market === "US") && (
              <div className="ml-auto">
                <CurrencyToggle />
              </div>
            )}
          </>
        }
      >
        <ImportButton />
        <ExportButton accountId={account} />
        <AddTradeButton accounts={accounts} defaultAccountId={account} label="추가" />
      </PageHeader>
      <TradeList trades={trades} accounts={accounts} showAccount={!account} />
    </>
  );
}
