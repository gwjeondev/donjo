import { FilterRow } from "@/components/filter-row";
import { FxNote } from "@/components/fx-note";
import { MarketFilter, type MarketGroup } from "@/components/market-filter";
import { PageHeader } from "@/components/page-header";
import { ReloadRegion } from "@/components/reload-region";
import { StockList } from "@/components/stock-list";
import { loadPortfolio, loadPrefs } from "@/lib/data";
import { mergeBySymbol } from "@/lib/portfolio";
import { requireUserId } from "@/lib/session";

export const metadata = { title: "종목" };

export default async function StocksPage({ searchParams }: { searchParams: Promise<{ account?: string; market?: string }> }) {
  const params = await searchParams;
  const account = params.account;
  const market: MarketGroup | undefined = params.market === "kr" || params.market === "us" ? params.market : undefined;
  const userId = await requireUserId();
  const [{ accounts, positions, fx, quotedAt }, prefs] = await Promise.all([loadPortfolio(userId, account), loadPrefs(userId)]);
  // 여러 계좌의 같은 종목은 하나로 합친다
  const stocks = mergeBySymbol(positions).filter((p) => !market || (market === "us" ? p.market === "US" : p.market !== "US"));

  return (
    <>
      <PageHeader title="종목" sub={<FxNote fx={fx} quotedAt={quotedAt} />} />
      <div className="mb-4">
        <FilterRow accounts={accounts.map((a) => ({ id: a.id, name: a.name }))} account={account} extra={<MarketFilter value={market} />}>
          {null}
        </FilterRow>
      </div>
      <ReloadRegion>
        <StockList key={`${account}|${market}`} positions={stocks} sort={prefs.holdings} />
      </ReloadRegion>
    </>
  );
}
