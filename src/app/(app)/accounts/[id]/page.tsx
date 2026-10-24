import Link from "next/link";
import { notFound } from "next/navigation";
import { AccountButton } from "@/components/account-form";
import { Holdings } from "@/components/holdings";
import { PageHeader } from "@/components/page-header";
import { SummaryCards } from "@/components/summary-cards";
import { AddRecordButton } from "@/components/add-record";
import { ChevronRightIcon } from "@/components/icons";
import { dividendStocks, loadPortfolio, loadPrefs } from "@/lib/data";
import { requireUserId } from "@/lib/session";

export default async function AccountPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await requireUserId();
  const [{ accounts, trades, positions, summary, dividendKrw, cashByAccount, fx }, prefs] = await Promise.all([
    loadPortfolio(userId, id),
    loadPrefs(userId),
  ]);
  const account = accounts.find((a) => a.id === id);
  if (!account) notFound();

  return (
    <>
      <div className="mt-2">
        <PageHeader title={account.name} sub={[account.broker, account.memo].filter(Boolean).join(" · ") || undefined}>
          <AccountButton initial={account} />
          <AddRecordButton accounts={accounts} stocks={dividendStocks(trades)} defaultAccountId={account.id} />
        </PageHeader>
      </div>
      <div className="space-y-5">
        <SummaryCards summary={summary} dividendKrw={dividendKrw} cash={cashByAccount.get(id)} usdKrw={fx.rate} />
        <Holdings positions={positions} totalValue={summary.valueKrw} usdKrw={fx.rate} sort={prefs.holdings} />
        {/* 기록 목록은 거래내역 화면에서 (이 계좌로 걸러서 연다) */}
        <nav className="grid grid-cols-1 gap-3 lg:grid-cols-3" aria-label="이 계좌 더 보기">
          {[
            { href: `/transactions?account=${account.id}`, label: "거래내역", desc: "매매·배당·입출금 기록" },
            { href: `/performance?account=${account.id}`, label: "수익률", desc: "기간별 투자 성과" },
            { href: `/income?account=${account.id}`, label: "손익", desc: "실현손익·배당금·양도세" },
          ].map((l) => (
            <Link key={l.href} href={l.href} className="card flex items-center justify-between gap-3 px-5 py-4 transition hover:border-brand/50">
              <span className="min-w-0">
                <span className="block font-semibold">{l.label}</span>
                <span className="block truncate text-xs text-muted">{l.desc}</span>
              </span>
              <ChevronRightIcon className="size-5 shrink-0 text-muted" />
            </Link>
          ))}
        </nav>
      </div>
    </>
  );
}
