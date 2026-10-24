import Link from "next/link";
import { FilterRow, StatCard } from "@/components/filter-row";
import { AddDividendButton, DeleteDividendButton, EditDividendButton, type DividendStock } from "@/components/dividend-form";
import { PageHeader } from "@/components/page-header";
import { QueryTabs } from "@/components/query-select";
import { RangeFilter } from "@/components/range-bar";
import { todayStr } from "@/lib/market/service";
import { parseRange, rangeBounds, rangeQuery } from "@/lib/range";
import { loadDividends, loadTrades } from "@/lib/data";
import { prisma } from "@/lib/db";
import { fmtKrw, fmtPct, fmtPrice, fmtQty, fmtSigned, tone } from "@/lib/format";
import { dividendNetKrw, incomeByYear, realizedEvents } from "@/lib/income";
import { requireUserId } from "@/lib/session";

export const metadata = { title: "손익" };

const stockHref = (symbol: string) => `/stocks/${encodeURIComponent(symbol)}`;
const code = (symbol: string) => symbol.replace(/\.(KS|KQ)$/, "");

export default async function IncomePage({
  searchParams,
}: {
  searchParams: Promise<{ account?: string; tab?: string; range?: string; from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const account = params.account;
  const tab = params.tab === "dividend" ? "dividend" : "realized";
  const userId = await requireUserId();
  const [accounts, trades, allDividends] = await Promise.all([
    prisma.account.findMany({ where: { userId }, orderBy: { createdAt: "asc" }, select: { id: true, name: true } }),
    loadTrades(userId, account),
    loadDividends(userId, account),
  ]);
  const accountName = new Map(accounts.map((a) => [a.id, a.name]));

  // 실현손익은 계좌의 모든 매매로 평균단가를 따라가며 계산한 뒤 연도로 거른다
  const allEvents = realizedEvents(trades).reverse();
  const years = incomeByYear(allEvents, allDividends);
  // 조회 기간: 수익률 화면과 같은 버튼 (기본 전체)
  const { range, custom } = parseRange(params, "전체");
  const today = todayStr();
  const { from, to } = rangeBounds(range, today, custom);
  const inRange = (date: string) => (!from || date >= from) && (!to || date <= to);
  const events = allEvents.filter((e) => inRange(e.date));
  const dividends = allDividends.filter((d) => inRange(d.payDate));
  const firstDate = [...allEvents.map((e) => e.date), ...allDividends.map((d) => d.payDate)].sort()[0];
  const period = range === "전체" ? "전체 기간" : `${(from ?? firstDate ?? today).replaceAll("-", ".")} ~ ${(to ?? today).replaceAll("-", ".")}`;
  // 연도 표의 연도를 누르면 그 해 1/1 ~ 12/31을 직접입력으로 본다
  const yearHref = (y: string) =>
    `?${new URLSearchParams({ ...(account ? { account } : {}), ...(tab === "dividend" ? { tab } : {}), range: "custom", from: `${y}-01-01`, to: `${y}-12-31` })}`;

  const realizedKrw = events.reduce((s, e) => s + e.pnlKrw, 0);
  const dividendKrw = dividends.reduce((s, d) => s + dividendNetKrw(d), 0);

  // 배당 입력용 종목 목록: 계좌별로 거래한 적 있는 종목 (가장 최근 이름)
  const stockMap = new Map<string, DividendStock>();
  const allTrades = account ? await loadTrades(userId) : trades;
  for (const t of allTrades) {
    const k = `${t.accountId}|${t.symbol}`;
    if (!stockMap.has(k)) stockMap.set(k, { accountId: t.accountId, symbol: t.symbol, name: t.name, market: t.market });
  }
  const stocks = [...stockMap.values()].sort((a, b) => a.name.localeCompare(b.name, "ko"));

  return (
    <>
      <PageHeader
        title="손익"
        sub="매도로 확정된 손익과 받은 배당금이에요"
      >
        <AddDividendButton accounts={accounts} stocks={stocks} defaultAccountId={account} />
      </PageHeader>

      <div className="space-y-5">
        <FilterRow accounts={accounts} account={account}>
          <RangeFilter
            key={`${range}|${custom.from}|${custom.to}`}
            range={range}
            custom={custom}
            fallback="전체"
            min={firstDate}
            max={today}
            shown={period}
          />
        </FilterRow>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard label="실현손익" value={fmtSigned(realizedKrw)} valueClass={tone(realizedKrw)} sub={`매도 ${events.length}건`} />
          <StatCard label="배당금 (세후)" value={fmtSigned(dividendKrw)} valueClass={tone(dividendKrw)} sub={`${dividends.length}건`} />
          <StatCard
            label="확정 손익 합계"
            value={fmtSigned(realizedKrw + dividendKrw)}
            valueClass={tone(realizedKrw + dividendKrw)}
            sub={
              <Link href={`/performance?${new URLSearchParams({ ...(account ? { account } : {}), ...rangeQuery(range, custom) })}`} className="text-brand hover:underline">
                수익률 보기 →
              </Link>
            }
          />
        </div>

        {range === "전체" && years.length > 1 && (
          <section>
            <h2 className="mb-2 font-semibold">연도별</h2>
            <div className="card overflow-hidden">
              <table className="w-full table-fixed text-sm">
                <thead className="border-b border-line bg-surface-2 text-xs text-ink-2">
                  <tr>
                    <th className="w-20 px-4 py-2.5 text-left font-medium">연도</th>
                    <th className="px-2 py-2.5 text-right font-medium">실현손익</th>
                    <th className="px-2 py-2.5 text-right font-medium">배당금</th>
                    <th className="hidden px-4 py-2.5 text-right font-medium sm:table-cell">합계</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {years.map((y) => (
                    <tr key={y.year}>
                      <td className="px-4 py-2.5">
                        <Link href={yearHref(y.year)} className="text-brand hover:underline">
                          {y.year}
                        </Link>
                      </td>
                      <td className={`truncate px-2 py-2.5 text-right ${tone(y.realizedKrw)}`}>{fmtSigned(y.realizedKrw)}</td>
                      <td className={`truncate px-2 py-2.5 text-right ${tone(y.dividendKrw)}`}>{fmtSigned(y.dividendKrw)}</td>
                      <td className={`hidden px-4 py-2.5 text-right font-medium sm:table-cell ${tone(y.realizedKrw + y.dividendKrw)}`}>
                        {fmtSigned(y.realizedKrw + y.dividendKrw)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <section className="space-y-3">
          <QueryTabs
            name="tab"
            value={tab}
            tabs={[
              { value: "realized", label: `실현손익 ${events.length}` },
              { value: "dividend", label: `배당금 ${dividends.length}` },
            ]}
          />

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
            실현손익 = 매도 대금(수수료·세금 뺀 금액) − 판 수량의 평균 매입금액. 해외 주식은 매도일 환율과 매수일 환율로 원화 환산해요.
            배당금은 세후 금액이며 수익률 계산에도 들어가요.
          </p>
        </section>
      </div>
    </>
  );
}
