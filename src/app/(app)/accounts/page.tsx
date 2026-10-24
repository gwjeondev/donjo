import { AccountButton } from "@/components/account-form";
import { AccountList } from "@/components/account-list";
import { FxNote } from "@/components/fx-note";
import { PageHeader } from "@/components/page-header";
import { loadPortfolio, loadPrefs } from "@/lib/data";
import { summarize } from "@/lib/portfolio";
import { cashKrw, hasCash } from "@/lib/cash";
import { requireUserId } from "@/lib/session";

export const metadata = { title: "계좌" };

export default async function AccountsPage() {
  const userId = await requireUserId();
  const [{ accounts, positions, cashByAccount, fx, quotedAt }, prefs] = await Promise.all([loadPortfolio(userId), loadPrefs(userId)]);
  // 계좌는 만든 순으로 읽어 오므로 그 위치를 '만든 순' 정렬값으로 쓴다
  const cards = accounts.map((a, order) => {
    const ps = positions.filter((p) => p.accountId === a.id);
    const c = cashByAccount.get(a.id);
    return {
      id: a.id,
      name: a.name,
      broker: a.broker,
      order,
      count: ps.filter((p) => p.quantity > 0).length,
      summary: summarize(ps),
      cashKrw: c && hasCash(c) ? cashKrw(c, fx.rate) : null,
    };
  });

  return (
    <>
      <PageHeader title="계좌" sub={<FxNote fx={fx} quotedAt={quotedAt} />}>
        <AccountButton />
      </PageHeader>
      {accounts.length === 0 && <p className="card p-8 text-center text-sm text-muted">계좌를 추가해 주세요.</p>}
      <AccountList accounts={cards} sort={prefs.accounts} />
    </>
  );
}
