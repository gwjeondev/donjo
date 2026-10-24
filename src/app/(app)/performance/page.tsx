import { PageHeader } from "@/components/page-header";
import { PerformancePanel } from "@/components/performance-panel";
import { loadPerformance } from "@/lib/data";
import { prisma } from "@/lib/db";
import { todayStr } from "@/lib/market/service";
import { parseRange, rangeBounds } from "@/lib/range";
import { requireUserId } from "@/lib/session";

export const metadata = { title: "수익률" };

export default async function PerformancePage({
  searchParams,
}: {
  searchParams: Promise<{ account?: string; range?: string; from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const { account } = params;
  const { range, custom } = parseRange(params);
  // 고른 기간 부근의 시세만 받아 계산한다 (기본 1M이라 첫 화면이 빨리 뜬다)
  const { from } = rangeBounds(range, todayStr(), custom);
  const userId = await requireUserId();
  const [accounts, perf] = await Promise.all([
    prisma.account.findMany({ where: { userId }, orderBy: { createdAt: "asc" }, select: { id: true, name: true } }),
    loadPerformance(userId, account, from),
  ]);
  return (
    <>
      <PageHeader title="수익률" sub="입출금을 뺀 투자 성과를 시장과 비교해요" />
      <PerformancePanel
        // 기간을 바꾸면 새 데이터로 다시 그리도록
        key={`${range}|${custom.from}|${custom.to}|${account}`}
        accounts={accounts}
        account={account}
        range={range}
        custom={custom}
        firstTrade={perf.firstTrade}
        daily={perf.daily}
        benchmark={perf.benchmark}
        missing={perf.benchmarkMissing}
        failed={perf.failed}
      />
    </>
  );
}
