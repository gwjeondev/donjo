import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { AccountBreakdown, StockPriceChart, StockSummary, type PricePoint } from "@/components/stock-detail";
import { AddTradeButton } from "@/components/trade-form";
import { TradeList } from "@/components/trade-list";
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
  if (trades.length === 0) notFound();

  // 전량 매도한 종목도 현재가를 보여 주도록 시세를 따로 조회한다
  const quote = (await getQuotes([symbol])).get(symbol);
  const positions = allPositions.filter((p) => p.symbol === symbol).map((p) => valuePosition(p, quote, fx.rate));
  const [position] = mergeBySymbol(positions);
  const accountName = new Map(accounts.map((a) => [a.id, a.name]));

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
      <Link href="/dashboard" className="text-sm text-ink-2 hover:text-ink">← 대시보드</Link>
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
          <AddTradeButton accounts={accounts} preset={{ symbol: position.symbol, name: position.name, market: position.market }} />
        </PageHeader>
      </div>
      <div className="space-y-5">
        <StockSummary position={position} usdKrw={fx.rate} />
        <StockPriceChart points={points} avgCost={position.quantity > 0 ? position.avgCost : null} currency={currency} />
        <AccountBreakdown rows={positions.map((p) => ({ ...p, accountName: accountName.get(p.accountId) ?? "" }))} usdKrw={fx.rate} />
        <section>
          <h2 className="mb-2 font-semibold">매매 기록</h2>
          <TradeList trades={trades} accounts={accounts} />
        </section>
      </div>
    </>
  );
}
