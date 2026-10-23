import { AccountFilter } from "@/components/account-filter";
import { PageHeader } from "@/components/page-header";
import { PerformancePanel } from "@/components/performance-panel";
import { loadPerformance } from "@/lib/data";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/session";

export const metadata = { title: "수익률" };

export default async function PerformancePage({ searchParams }: { searchParams: Promise<{ account?: string }> }) {
  const { account } = await searchParams;
  const userId = await requireUserId();
  const [accounts, perf] = await Promise.all([
    prisma.account.findMany({ where: { userId }, orderBy: { createdAt: "asc" }, select: { id: true, name: true } }),
    loadPerformance(userId, account, { breakdown: true }),
  ]);
  return (
    <>
      <PageHeader
        title="수익률"
        sub="기간별 · 종목별 · 계좌별 수익률"
        toolbar={<AccountFilter accounts={accounts} value={account} />}
      />
      <PerformancePanel daily={perf.daily} benchmark={perf.benchmark} missing={perf.benchmarkMissing} failed={perf.failed} byStock={perf.byStock} byAccount={perf.byAccount} />
    </>
  );
}
