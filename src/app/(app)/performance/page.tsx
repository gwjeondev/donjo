import { AccountFilter } from "@/components/account-filter";
import { PageHeader } from "@/components/page-header";
import { PerformanceView } from "@/components/performance-view";
import { loadPerformance } from "@/lib/data";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/session";

export const metadata = { title: "수익률" };

export default async function PerformancePage({ searchParams }: { searchParams: Promise<{ account?: string }> }) {
  const { account } = await searchParams;
  const userId = await requireUserId();
  const [accounts, perf] = await Promise.all([
    prisma.account.findMany({ where: { userId }, orderBy: { createdAt: "asc" }, select: { id: true, name: true } }),
    loadPerformance(userId, account),
  ]);
  return (
    <>
      <PageHeader title="수익률" sub="일별 · 월별 · 연도별 자산 증가율">
        <AccountFilter accounts={accounts} value={account} />
      </PageHeader>
      <PerformanceView rows={{ day: perf.day, month: perf.month, year: perf.year }} failed={perf.failed} />
    </>
  );
}
