import Link from "next/link";
import { AccountButton } from "@/components/account-form";
import { FxNote } from "@/components/fx-note";
import { PageHeader } from "@/components/page-header";
import { loadPortfolio } from "@/lib/data";
import { fmtKrw, fmtPct, fmtSigned, tone } from "@/lib/format";
import { summarize } from "@/lib/portfolio";
import { requireUserId } from "@/lib/session";

export const metadata = { title: "계좌" };

export default async function AccountsPage() {
  const userId = await requireUserId();
  const { accounts, positions, fx } = await loadPortfolio(userId);

  return (
    <>
      <PageHeader title="계좌" sub={<FxNote fx={fx} />}>
        <AccountButton />
      </PageHeader>
      {accounts.length === 0 && <p className="card p-8 text-center text-sm text-muted">계좌를 추가해 주세요.</p>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {accounts.map((a) => {
          const ps = positions.filter((p) => p.accountId === a.id);
          const s = summarize(ps);
          const count = ps.filter((p) => p.quantity > 0).length;
          return (
            <Link key={a.id} href={`/accounts/${a.id}`} className="card block p-5 transition hover:border-brand/50">
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="truncate font-semibold">{a.name}</h2>
                <span className="shrink-0 text-xs text-muted">{a.broker ?? ""}</span>
              </div>
              <p className="mt-3 text-2xl font-bold">{fmtKrw(s.valueKrw)}</p>
              <p className={`mt-1 text-sm ${tone(s.unrealizedPnlKrw)}`}>
                {fmtSigned(s.unrealizedPnlKrw)} ({fmtPct(s.returnRate)})
              </p>
              <p className="mt-3 text-xs text-muted">
                보유 {count}종목 · 실현손익 <span className={tone(s.realizedPnlKrw)}>{fmtSigned(s.realizedPnlKrw)}</span>
              </p>
            </Link>
          );
        })}
      </div>
    </>
  );
}
