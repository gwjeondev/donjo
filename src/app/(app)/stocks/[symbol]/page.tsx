import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { RenameStockButton } from "@/components/rename-stock";
import { AccountBreakdown, StockPriceChart, StockSummary, type PricePoint } from "@/components/stock-detail";
import { AddTradeButton } from "@/components/trade-form";
import { LinkCards } from "@/components/link-cards";
import { loadPortfolio } from "@/lib/data";
import { fmtPct, fmtPrice, MARKET_LABEL, tone } from "@/lib/format";
import { getPriceSeries, getQuotes } from "@/lib/market/service";
import { mergeBySymbol, sortTrades, valuePosition } from "@/lib/portfolio";
import { requireUserId } from "@/lib/session";

export async function generateMetadata({ params }: { params: Promise<{ symbol: string }> }) {
  return { title: decodeURIComponent((await params).symbol).replace(/\.(KS|KQ)$/, "") };
}

export default async function StockPage({ params }: { params: Promise<{ symbol: string }> }) {
  const symbol = decodeURIComponent((await params).symbol);
  const userId = await requireUserId();
  const { accounts, trades: allTrades, positions: allPositions, fx } = await loadPortfolio(userId);
  const trades = allTrades.filter((t) => t.symbol === symbol);
  // 기록이 없는 종목(예: 이 화면에서 마지막 매매 기록을 지운 경우)은 대시보드로 돌아간다
  if (trades.length === 0) redirect("/dashboard");

  // 전량 매도한 종목도 현재가를 보여 주도록 시세를 따로 조회한다
  const quote = (await getQuotes([symbol])).get(symbol);
  const positions = allPositions.filter((p) => p.symbol === symbol).map((p) => valuePosition(p, quote, fx.rate));
  const [position] = mergeBySymbol(positions);
  const accountName = new Map(accounts.map((a) => [a.id, a.name]));
  // 매매 추가 시 계좌는 이 종목을 가장 많이 가진 계좌로 (다 팔았으면 마지막으로 거래한 계좌)
  const mainAccount =
    [...positions].sort((a, b) => b.quantity - a.quantity).find((p) => p.quantity > 0)?.accountId ?? trades[0].accountId;

  // 가격 추이 (실패해도 나머지는 보여 준다)
  const sorted = sortTrades(trades);
  const series = await getPriceSeries([symbol], sorted[0].tradeDate).catch(() => new Map<string, Map<string, number>>());
  const closes = [...(series.get(symbol) ?? new Map<string, number>())].sort(([a], [b]) => a.localeCompare(b));
  const points: PricePoint[] = closes.map(([date, close]) => ({ date, close }));
  // 매매 지점은 그날(휴장일이면 다음 거래일) 위에 표시
  for (const t of sorted) {
    const p = points.find((x) => x.date >= t.tradeDate);
    if (p) p[t.type === "BUY" ? "buy" : "sell"] = t.price;
  }

  const change = quote?.previousClose ? quote.price / quote.previousClose - 1 : null;
  const code = symbol.replace(/\.(KS|KQ)$/, "");
  const currency = position.currency;

  return (
    <>
      <div className="mt-2">
        <PageHeader
          title={position.name}
          sub={
            <span className="inline-flex flex-wrap items-center gap-x-2">
              <span>{MARKET_LABEL[position.market]} · {code}</span>
              {quote && (
                <span className="font-medium text-ink">
                  {fmtPrice(quote.price, currency)}
                  {change != null && <span className={`ml-1.5 ${tone(change)}`}>{fmtPct(change)}</span>}
                </span>
              )}
            </span>
          }
        >
          <RenameStockButton symbol={position.symbol} name={position.name} />
          <AddTradeButton accounts={accounts} defaultAccountId={mainAccount} preset={{ symbol: position.symbol, name: position.name, market: position.market }} />
        </PageHeader>
      </div>
      <div className="space-y-5">
        <StockSummary position={position} usdKrw={fx.rate} />
        <StockPriceChart points={points} avgCost={position.quantity > 0 ? position.avgCost : null} currency={currency} />
        <AccountBreakdown rows={positions.map((p) => ({ ...p, accountName: accountName.get(p.accountId) ?? "" }))} usdKrw={fx.rate} />
        {/* 기록 목록은 거래내역 화면에서 (이 종목으로 걸러서 전체 기간으로 연다) */}
        <LinkCards
          label="이 종목 더 보기"
          links={[
            { href: `/transactions?symbol=${encodeURIComponent(symbol)}&range=all`, label: "거래내역", desc: "이 종목의 매매·배당 기록" },
            { href: `/income?symbol=${encodeURIComponent(symbol)}&range=all`, label: "손익", desc: "이 종목의 실현손익·배당금" },
          ]}
        />
      </div>
    </>
  );
}
