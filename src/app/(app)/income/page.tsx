import Link from "next/link";
import { AddDividendButton, DeleteDividendButton, EditDividendButton, type DividendStock } from "@/components/dividend-form";
import { FilterRow, StatCard } from "@/components/filter-row";
import { MarketFilter, type MarketGroup } from "@/components/market-filter";
import { PageHeader } from "@/components/page-header";
import { QuerySelect, QueryTabs } from "@/components/query-select";
import { RangeFilter } from "@/components/range-bar";
import { loadDividends, loadTrades } from "@/lib/data";
import { prisma } from "@/lib/db";
import { fmtKrw, fmtPct, fmtPrice, fmtQty, fmtSigned, tone } from "@/lib/format";
import { dividendNetKrw, incomeByYear, realizedEvents } from "@/lib/income";
import { todayStr } from "@/lib/market/service";
import type { Market } from "@/lib/portfolio";
import { parseRange, rangeBounds, rangeQuery } from "@/lib/range";
import { requireUserId } from "@/lib/session";
import { OVERSEAS_DEDUCTION, overseasSales, overseasTax } from "@/lib/tax";

export const metadata = { title: "손익" };

const stockHref = (symbol: string) => `/stocks/${encodeURIComponent(symbol)}`;
const code = (symbol: string) => symbol.replace(/\.(KS|KQ)$/, "");
const dot = (d: string) => d.replaceAll("-", ".");
const inMarket = (m: Market, g?: MarketGroup) => !g || (g === "us" ? m === "US" : m !== "US");

type Tab = "realized" | "dividend" | "tax";

export default async function IncomePage({
  searchParams,
}: {
  searchParams: Promise<{
    account?: string;
    tab?: string;
    market?: string;
    range?: string;
    from?: string;
    to?: string;
    year?: string;
  }>;
}) {
  const params = await searchParams;
  const account = params.account;
  const tab: Tab = params.tab === "dividend" || params.tab === "tax" ? params.tab : "realized";
  const market: MarketGroup | undefined = params.market === "kr" || params.market === "us" ? params.market : undefined;
  const userId = await requireUserId();
  const [accounts, trades, allDividends] = await Promise.all([
    prisma.account.findMany({ where: { userId }, orderBy: { createdAt: "asc" }, select: { id: true, name: true } }),
    loadTrades(userId, account),
    loadDividends(userId, account),
  ]);
  const accountName = new Map(accounts.map((a) => [a.id, a.name]));
  const today = todayStr();

  // 배당 입력용 종목 목록: 계좌별로 거래한 적 있는 종목 (가장 최근 이름)
  const stockMap = new Map<string, DividendStock>();
  for (const t of account ? await loadTrades(userId) : trades) {
    const k = `${t.accountId}|${t.symbol}`;
    if (!stockMap.has(k)) stockMap.set(k, { accountId: t.accountId, symbol: t.symbol, name: t.name, market: t.market });
  }
  const stocks = [...stockMap.values()].sort((a, b) => a.name.localeCompare(b.name, "ko"));

  const tabs = (
    <QueryTabs
      name="tab"
      value={tab}
      tabs={[
        { value: "realized", label: "실현손익" },
        { value: "dividend", label: "배당금" },
        { value: "tax", label: "양도세" },
      ]}
    />
  );

  return (
    <>
      <PageHeader title="손익" sub="매도로 확정된 손익, 받은 배당금, 해외주식 양도세 예상액이에요">
        <AddDividendButton accounts={accounts} stocks={stocks} defaultAccountId={account} />
      </PageHeader>
      <div className="space-y-5">
        {tabs}
        {tab === "tax" ? (
          <TaxView params={params} accounts={accounts} account={account} trades={trades} accountName={accountName} today={today} />
        ) : (
          <IncomeView
            tab={tab}
            params={params}
            accounts={accounts}
            account={account}
            market={market}
            trades={trades}
            allDividends={allDividends}
            accountName={accountName}
            stocks={stocks}
            today={today}
          />
        )}
      </div>
    </>
  );
}

/** 실현손익·배당금 탭: 계좌·국내/해외·기간으로 거른다 */
function IncomeView({
  tab,
  params,
  accounts,
  account,
  market,
  trades,
  allDividends,
  accountName,
  stocks,
  today,
}: {
  tab: "realized" | "dividend";
  params: { range?: string; from?: string; to?: string };
  accounts: { id: string; name: string }[];
  account?: string;
  market?: MarketGroup;
  trades: Awaited<ReturnType<typeof loadTrades>>;
  allDividends: Awaited<ReturnType<typeof loadDividends>>;
  accountName: Map<string, string>;
  stocks: DividendStock[];
  today: string;
}) {
  // 실현손익은 계좌의 모든 매매로 평균단가를 따라가며 계산한 뒤 기간·시장으로 거른다
  const marketEvents = realizedEvents(trades)
    .reverse()
    .filter((e) => inMarket(e.market, market));
  const marketDividends = allDividends.filter((d) => inMarket(d.market, market));
  const { range, custom } = parseRange(params);
  const { from, to } = rangeBounds(range, today, custom);
  const inRange = (date: string) => (!from || date >= from) && (!to || date <= to);
  const events = marketEvents.filter((e) => inRange(e.date));
  const dividends = marketDividends.filter((d) => inRange(d.payDate));
  const firstDate = [...marketEvents.map((e) => e.date), ...marketDividends.map((d) => d.payDate)].sort()[0];
  const period = range === "전체" ? "전체 기간" : `${dot(from ?? firstDate ?? today)} ~ ${dot(to ?? today)}`;
  const years = incomeByYear(marketEvents, marketDividends);
  const keep = { ...(account ? { account } : {}), ...(market ? { market } : {}), ...(tab === "dividend" ? { tab } : {}) };
  // 연도 표의 연도를 누르면 그 해 1/1 ~ 12/31을 직접입력으로 본다
  const yearHref = (y: string) => `?${new URLSearchParams({ ...keep, range: "custom", from: `${y}-01-01`, to: `${y}-12-31` })}`;

  const realizedKrw = events.reduce((s, e) => s + e.pnlKrw, 0);
  const dividendKrw = dividends.reduce((s, d) => s + dividendNetKrw(d), 0);

  return (
    <>
      <FilterRow accounts={accounts} account={account} extra={<MarketFilter value={market} />}>
        <RangeFilter key={`${range}|${custom.from}|${custom.to}`} range={range} custom={custom} fallback="1M" min={firstDate} max={today} shown={period} />
      </FilterRow>

      {/* 탭마다 그 탭의 합계 카드 하나만 */}
      {tab === "realized" ? (
        <StatCard
          label="실현손익"
          value={fmtSigned(realizedKrw)}
          valueClass={tone(realizedKrw)}
          sub={
            <>
              매도 {events.length}건 ·{" "}
              <Link href={`/performance?${new URLSearchParams({ ...(account ? { account } : {}), ...rangeQuery(range, custom) })}`} className="text-brand hover:underline">
                수익률 보기 →
              </Link>
            </>
          }
        />
      ) : (
        <StatCard label="배당금 (세후)" value={fmtSigned(dividendKrw)} valueClass={tone(dividendKrw)} sub={`${dividends.length}건`} />
      )}

      {range === "전체" && years.filter((y) => (tab === "realized" ? y.sells : y.dividendKrw)).length > 1 && (
        <section>
          <h2 className="mb-2 font-semibold">연도별</h2>
          <div className="card overflow-hidden">
            <table className="w-full table-fixed text-sm">
              <thead className="border-b border-line bg-surface-2 text-xs text-ink-2">
                <tr>
                  <th className="w-20 px-4 py-2.5 text-left font-medium">연도</th>
                  <th className="px-4 py-2.5 text-right font-medium">{tab === "realized" ? "실현손익" : "배당금 (세후)"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {years.filter((y) => (tab === "realized" ? y.sells : y.dividendKrw)).map((y) => (
                  <tr key={y.year}>
                    <td className="px-4 py-2.5">
                      <Link href={yearHref(y.year)} className="text-brand hover:underline">
                        {y.year}
                      </Link>
                    </td>
                    <td className={`truncate px-4 py-2.5 text-right font-medium ${tone(tab === "realized" ? y.realizedKrw : y.dividendKrw)}`}>
                      {fmtSigned(tab === "realized" ? y.realizedKrw : y.dividendKrw)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="font-semibold">{tab === "realized" ? `매도 내역 ${events.length}건` : `배당 내역 ${dividends.length}건`}</h2>
        {tab === "realized" ? (
          events.length === 0 ? (
            <p className="card p-8 text-center text-sm text-muted">이 기간에는 매도 기록이 없어요.</p>
          ) : (
            <ul className="card divide-y divide-line overflow-hidden">
              {events.map((e) => (
                <li key={e.tradeId} className="flex items-start justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <Link href={stockHref(e.symbol)} className="block truncate font-medium hover:text-brand hover:underline" title={e.name}>
                      {e.name}
                    </Link>
                    <p className="truncate text-xs text-muted">
                      {e.date} · {account ? "" : `${accountName.get(e.accountId)} · `}
                      {fmtQty(e.quantity)}주 · 매도 {fmtPrice(e.price, e.currency)} / 평단 {fmtPrice(e.avgCost, e.currency)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={`font-semibold ${tone(e.pnlKrw)}`}>{fmtSigned(e.pnlKrw)}</p>
                    <p className={`text-xs ${tone(e.returnRate)}`}>{fmtPct(e.returnRate)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )
        ) : dividends.length === 0 ? (
          <p className="card p-8 text-center text-sm text-muted">이 기간에 받은 배당금이 없어요. 오른쪽 위 ‘배당’으로 추가해 보세요.</p>
        ) : (
          <ul className="card divide-y divide-line overflow-hidden">
            {dividends.map((d) => {
              const currency = d.market === "US" ? "USD" : "KRW";
              return (
                <li key={d.id} className="flex items-start justify-between gap-2 px-4 py-3">
                  <div className="min-w-0">
                    <Link href={stockHref(d.symbol)} className="block truncate font-medium hover:text-brand hover:underline" title={d.name}>
                      {d.name}
                    </Link>
                    <p className="truncate text-xs text-muted">
                      {d.payDate} · {account ? "" : `${accountName.get(d.accountId)} · `}
                      세전 {fmtPrice(d.amount, currency)}
                      {d.tax ? ` · 세금 ${fmtPrice(d.tax, currency)}` : ""}
                      {d.memo ? ` · ${d.memo}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-start gap-1">
                    <div className="text-right">
                      <p className="font-semibold text-up">+{fmtKrw(dividendNetKrw(d))}</p>
                      <p className="text-xs text-muted">{code(d.symbol)}</p>
                    </div>
                    <EditDividendButton accounts={accounts} stocks={stocks} dividend={d} />
                    <DeleteDividendButton id={d.id} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <p className="text-xs leading-relaxed text-muted">
          실현손익 = 매도 대금(수수료·세금 뺀 금액) − 판 수량의 평균 매입금액. 해외 주식은 매도일 환율과 매수일 환율로 원화 환산해요. 배당금은 세후
          금액이에요.
        </p>
      </section>
    </>
  );
}

/** 양도세 탭: 해외 상장 주식의 연간 양도소득세 추정 (연도 단위) */
function TaxView({
  params,
  accounts,
  account,
  trades,
  accountName,
  today,
}: {
  params: { year?: string };
  accounts: { id: string; name: string }[];
  account?: string;
  trades: Awaited<ReturnType<typeof loadTrades>>;
  accountName: Map<string, string>;
  today: string;
}) {
  const thisYear = today.slice(0, 4);
  const sellYears = [...new Set(trades.filter((t) => t.market === "US" && t.type === "SELL").map((t) => t.tradeDate.slice(0, 4)))];
  const years = [...new Set([thisYear, ...sellYears])].sort().reverse();
  const year = params.year && years.includes(params.year) ? params.year : thisYear;
  // 취득가액은 이동평균 (증권사 앱·실현손익 탭과 같은 기준). 한 가지로 고정한다
  const sales = overseasSales(trades, year, "avg").reverse();
  const tax = overseasTax(sales);

  return (
    <>
      <FilterRow
        accounts={accounts}
        account={account}
        extra={
          <QuerySelect
            name="year"
            label="연도"
            value={year}
            fallback={thisYear}
            options={years.map((y) => ({ value: y, label: `${y}년` }))}
          />
        }
      >
        {null}
      </FilterRow>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          label={`${year}년 해외주식 양도차익`}
          value={fmtSigned(tax.gainKrw)}
          valueClass={tone(tax.gainKrw)}
          sub={`이익 ${fmtSigned(tax.profitKrw)} · 손실 ${fmtSigned(tax.lossKrw)}`}
        />
        <StatCard
          label="기본공제 후 과세표준"
          value={fmtKrw(tax.taxableKrw)}
          sub={tax.roomKrw > 0 ? `공제 한도까지 ${fmtKrw(tax.roomKrw)} 남았어요` : `기본공제 ${fmtKrw(OVERSEAS_DEDUCTION)} 적용`}
        />
        <StatCard
          label="예상 양도소득세 (22%)"
          value={fmtKrw(tax.taxKrw)}
          valueClass={tax.taxKrw > 0 ? "text-up" : ""}
          sub={`${Number(year) + 1}년 5월에 신고·납부해요`}
        />
      </div>

      <section className="space-y-2">
        <h2 className="font-semibold">해외주식 매도 {sales.length}건</h2>
        {sales.length === 0 ? (
          <p className="card p-8 text-center text-sm text-muted">{year}년에는 해외 주식을 판 기록이 없어요.</p>
        ) : (
          <ul className="card divide-y divide-line overflow-hidden">
            {sales.map((s) => (
              <li key={s.tradeId} className="flex items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <Link href={stockHref(s.symbol)} className="block truncate font-medium hover:text-brand hover:underline" title={s.name}>
                    {s.name}
                  </Link>
                  <p className="truncate text-xs text-muted">
                    {s.date} · {account ? "" : `${accountName.get(s.accountId)} · `}
                    {fmtQty(s.quantity)}주 · 양도 {fmtKrw(s.proceedsKrw)} / 취득 {fmtKrw(s.costKrw)}
                  </p>
                </div>
                <p className={`shrink-0 font-semibold ${tone(s.gainKrw)}`}>{fmtSigned(s.gainKrw)}</p>
              </li>
            ))}
          </ul>
        )}
        <div className="space-y-1 text-xs leading-relaxed text-muted">
          <p>
            해외 상장 주식(미국 주식 등)만 계산해요. 1년 동안의 이익과 손실을 합친 뒤 기본공제 250만 원을 빼고 22%(양도소득세 20% + 지방소득세
            2%)를 곱한 예상액이에요.
          </p>
          <p>
            취득가액은 이동평균(평균 매입단가)으로 계산해요. 실현손익 탭, 증권사 앱에서 팔 때 보이는 손익과 같은 기준이에요. 원화 환산은 기록한
            매수·매도 환율을 써서, 결제일 환율로 하는 실제 신고와는 조금 다를 수 있어요.
          </p>
          <p>
            국내 상장 해외 ETF(예: KODEX 미국나스닥100)의 매매차익은 양도세가 아니라 배당소득세(15.4%) 대상이라 여기에 넣지 않았고, 국내 주식은
            대주주가 아니면 양도세가 없어요. 실제 신고 전에는 증권사 양도세 계산 자료나 세무 전문가로 확인해 주세요.
          </p>
        </div>
      </section>
    </>
  );
}
