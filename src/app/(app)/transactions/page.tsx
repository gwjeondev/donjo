import { AccountFilter } from "@/components/account-filter";
import { CurrencyToggle } from "@/components/currency";
import { MarketFilter, type MarketGroup } from "@/components/market-filter";
import { DateRangeFilter } from "@/components/range-bar";
import { TradeSearch } from "@/components/trade-search";
import { todayStr } from "@/lib/market/service";
import { rangeBounds } from "@/lib/range";
import { TradeSort, type TradeOrder } from "@/components/trade-sort";
import { ExportButton, ImportButton } from "@/components/csv-actions";
import { PageHeader } from "@/components/page-header";
import { AddRecordButton } from "@/components/add-record";
import { QuerySelect } from "@/components/query-select";
import { TradeList } from "@/components/trade-list";
import { FilterChip } from "@/components/filter-chip";
import { symbolName } from "@/lib/format";
import { prisma } from "@/lib/db";
import { dividendStocks, loadCashFlows, loadDividends, loadPrefs, loadTrades } from "@/lib/data";
import { requireUserId } from "@/lib/session";

export const metadata = { title: "거래내역" };

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ account?: string; market?: string; kind?: string; q?: string; symbol?: string; sort?: string; from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const account = params.account;
  const market: MarketGroup | undefined = params.market === "kr" || params.market === "us" ? params.market : undefined;
  const userId = await requireUserId();
  const kind = params.kind === "trade" || params.kind === "dividend" || params.kind === "cash" ? params.kind : undefined;
  const [accounts, allTrades, allDividends, allCash, prefs, everyTrade] = await Promise.all([
    prisma.account.findMany({ where: { userId }, orderBy: { createdAt: "asc" }, select: { id: true, name: true } }),
    loadTrades(userId, account),
    loadDividends(userId, account),
    loadCashFlows(userId, account),
    loadPrefs(userId),
    account ? loadTrades(userId) : null,
  ]);
  // 주소에 정렬이 없으면 설정의 기본 정렬
  const order: TradeOrder = params.sort === "old" || params.sort === "new" ? params.sort : prefs.trades;
  // 국내(코스피·코스닥) / 해외(미국) 구분
  const q = (params.q ?? "").trim().toLowerCase();
  // 종목 상세에서 넘어오면 그 종목만 (종목코드가 정확히 같은 것)
  const symbol = params.symbol || undefined;
  // 조회 기간: 시작일 ~ 종료일 (기본: 한 달 전 ~ 오늘)
  const today = todayStr();
  const defaultFrom = rangeBounds("1M", today).from!;
  const isDate = (v?: string) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
  let from = isDate(params.from) ? params.from! : defaultFrom;
  let to = isDate(params.to) ? params.to! : today;
  if (from > to) [from, to] = [to, from];
  const firstDate = [allTrades.at(-1)?.tradeDate, allDividends.at(-1)?.payDate, allCash.at(-1)?.date].filter(Boolean).sort()[0];
  const filtered = from !== defaultFrom || to !== today;
  const inRange = (d: string) => d >= from && d <= to;
  const inMarket = (m: string) => !market || (market === "us" ? m === "US" : m !== "US");
  const matches = (name: string, s: string) =>
    (!symbol || s === symbol) && (!q || name.toLowerCase().includes(q) || s.replace(/\.(KS|KQ)$/, "").toLowerCase().includes(q));
  // 배당: 시장·검색 조건을 따른다. 현금: 종목이 없으니 시장·검색을 걸면 뺀다
  const dividends = kind && kind !== "dividend" ? [] : allDividends.filter((d) => inRange(d.payDate) && inMarket(d.market) && matches(d.name, d.symbol));
  const cashFlows = (kind && kind !== "cash") || market || q || symbol ? [] : allCash.filter((c) => inRange(c.date));
  const trades = (kind && kind !== "trade" ? [] : allTrades)
    .filter((t) => t.tradeDate >= from && t.tradeDate <= to)
    .filter((t) => !market || (market === "us" ? t.market === "US" : t.market !== "US"))
    .filter((t) => !symbol || t.symbol === symbol)
    // 종목 검색: 종목명 또는 종목코드(접미사 .KS/.KQ 제외)에 검색어가 들어 있으면
    .filter(
      (t) =>
        !q ||
        t.name.toLowerCase().includes(q) ||
        t.symbol
          .replace(/\.(KS|KQ)$/, "")
          .toLowerCase()
          .includes(q),
    );
  // 기록은 최신순(거래일, 같은 날은 입력 순서의 역순)으로 읽으므로 오래된순은 뒤집기만 하면 된다
  if (order === "old") trades.reverse();
  return (
    <>
      <PageHeader
        title="거래내역"
        sub={`총 ${trades.length + dividends.length + cashFlows.length}건`}
        toolbar={
          <>
            {/* 1줄: 계좌·종류, 2줄: 국내/해외·종목 검색·정렬·통화 (넓으면 한 줄) */}
            <div className="flex w-full min-w-0 items-center gap-2 @3xl:w-auto">
              <AccountFilter accounts={accounts} value={account} />
              <QuerySelect
                name="kind"
                label="종류"
                value={kind ?? ""}
                options={[
                  { value: "", label: "모든 종류" },
                  { value: "trade", label: "매수·매도" },
                  { value: "dividend", label: "배당" },
                  { value: "cash", label: "입출금·환전" },
                ]}
              />
            </div>
            <div className="flex w-full min-w-0 items-center gap-2 @3xl:w-auto @3xl:flex-1">
              <MarketFilter value={market} />
              <TradeSearch value={params.q ?? ""} />
              <TradeSort value={order} defaultOrder={prefs.trades} />
            </div>
          </>
        }
      >
        <ImportButton />
        <ExportButton accountId={account} />
        <AddRecordButton accounts={accounts} stocks={dividendStocks(everyTrade ?? allTrades)} defaultAccountId={account} />
      </PageHeader>
      <div className="-mt-2 mb-4 flex flex-wrap items-center justify-between gap-2">
        <DateRangeFilter key={`${from}|${to}`} from={from} to={to} defaultFrom={defaultFrom} defaultTo={today} min={firstDate} />
        {allTrades.some((t) => t.market === "US") && market !== "kr" && <CurrencyToggle />}
      </div>
      {symbol && (
        <div className="mb-3">
          <FilterChip label="종목" name="symbol" value={symbolName(symbol, allTrades, allDividends)} params={params} />
        </div>
      )}
      <TradeList
        trades={trades}
        dividends={dividends}
        cashFlows={cashFlows}
        stocks={dividendStocks(everyTrade ?? allTrades)}
        order={order}
        accounts={accounts}
        showAccount={!account}
        emptyText={allTrades.length || allDividends.length || allCash.length ? (q || market || symbol || filtered ? "조건에 맞는 거래 기록이 없어요." : "최근 한 달 동안의 거래 기록이 없어요. 시작일을 앞당겨 보세요.") : undefined}
      />
    </>
  );
}
