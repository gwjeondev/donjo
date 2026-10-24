import { AccountFilter } from "@/components/account-filter";
import { CurrencyToggle } from "@/components/currency";
import { MarketFilter, type MarketGroup } from "@/components/market-filter";
import { RangeFilter } from "@/components/range-bar";
import { TradeSearch } from "@/components/trade-search";
import { todayStr } from "@/lib/market/service";
import { parseRange, rangeBounds } from "@/lib/range";
import { TradeSort, type TradeOrder } from "@/components/trade-sort";
import { ExportButton, ImportButton } from "@/components/csv-actions";
import { PageHeader } from "@/components/page-header";
import { AddTradeButton } from "@/components/trade-form";
import { TradeList } from "@/components/trade-list";
import { prisma } from "@/lib/db";
import { loadPrefs, loadTrades } from "@/lib/data";
import { requireUserId } from "@/lib/session";

export const metadata = { title: "매매기록" };

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ account?: string; market?: string; q?: string; sort?: string; range?: string; from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const account = params.account;
  const market: MarketGroup | undefined = params.market === "kr" || params.market === "us" ? params.market : undefined;
  const userId = await requireUserId();
  const [accounts, allTrades, prefs] = await Promise.all([
    prisma.account.findMany({ where: { userId }, orderBy: { createdAt: "asc" }, select: { id: true, name: true } }),
    loadTrades(userId, account),
    loadPrefs(userId),
  ]);
  // 주소에 정렬이 없으면 설정의 기본 정렬
  const order: TradeOrder = params.sort === "old" || params.sort === "new" ? params.sort : prefs.trades;
  // 국내(코스피·코스닥) / 해외(미국) 구분
  const q = (params.q ?? "").trim().toLowerCase();
  // 조회 기간 (수익률·손익 화면과 같은 버튼, 기본 전체)
  const { range, custom } = parseRange(params, "전체");
  const today = todayStr();
  const { from, to } = rangeBounds(range, today, custom);
  const firstDate = allTrades.at(-1)?.tradeDate;
  const period = range === "전체" ? "전체 기간" : `${(from ?? today).replaceAll("-", ".")} ~ ${(to ?? today).replaceAll("-", ".")}`;
  const trades = allTrades
    .filter((t) => (!from || t.tradeDate >= from) && (!to || t.tradeDate <= to))
    .filter((t) => !market || (market === "us" ? t.market === "US" : t.market !== "US"))
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
        title="매매기록"
        sub={`총 ${trades.length}건`}
        toolbar={
          <>
            {/* 1줄: 무엇을 볼지(계좌·국내/해외), 2줄(모바일)/같은 줄(PC): 종목 검색과 통화 */}
            <div className="flex w-full min-w-0 items-center gap-2 @3xl:w-auto">
              <AccountFilter accounts={accounts} value={account} />
              <MarketFilter value={market} />
            </div>
            <div className="flex w-full min-w-0 items-center gap-2 @3xl:w-auto @3xl:flex-1">
              <TradeSearch value={params.q ?? ""} />
              <TradeSort value={order} defaultOrder={prefs.trades} />
              {allTrades.some((t) => t.market === "US") && market !== "kr" && (
                <div className="ml-auto shrink-0">
                  <CurrencyToggle />
                </div>
              )}
            </div>
          </>
        }
      >
        <ImportButton />
        <ExportButton accountId={account} />
        <AddTradeButton accounts={accounts} defaultAccountId={account} label="추가" />
      </PageHeader>
      <div className="-mt-2 mb-4">
        <RangeFilter
          key={`${range}|${custom.from}|${custom.to}`}
          range={range}
          custom={custom}
          fallback="전체"
          min={firstDate}
          max={today}
          shown={period}
        />
      </div>
      <TradeList
        trades={trades}
        accounts={accounts}
        showAccount={!account}
        emptyText={allTrades.length && (q || market || range !== "전체") ? "조건에 맞는 매매 기록이 없어요." : undefined}
      />
    </>
  );
}
