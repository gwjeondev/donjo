import { after } from "next/server";
import { AllocationChart } from "@/components/allocation-chart";
import { DividendMonthly } from "@/components/dividend-monthly";
import { MarketIndices } from "@/components/market-indices";
import { RankCard, type RankItem } from "@/components/rank-card";
import { FxNote } from "@/components/fx-note";
import { PageHeader } from "@/components/page-header";
import { SummaryCards } from "@/components/summary-cards";
import { Welcome } from "@/components/welcome";
import { loadDividends, loadPortfolio } from "@/lib/data";
import { fmtPct, fmtSigned } from "@/lib/format";
import { dividendNetKrw } from "@/lib/income";
import { cashKrw } from "@/lib/cash";
import { mergeBySymbol } from "@/lib/portfolio";
import { getIndexMoves, localizeStockNames, todayStr } from "@/lib/market/service";
import { requireUserId } from "@/lib/session";

export const metadata = { title: "대시보드" };

export default async function DashboardPage() {
  const userId = await requireUserId();
  // 영문 이름으로 저장된 국내 종목은 증권사 표기 한글 이름으로 바꾼다. 화면을 그린 뒤에 하므로 기다리지 않는다
  after(() => localizeStockNames(userId).catch((e) => console.error("[names] 한글 이름 변환 실패:", e)));
  // 자산 추이는 일별 시세를 계산해야 해서 여기서 하지 않고, 총자산 카드의 '자산 추이' 버튼을 누를 때 불러온다
  const [{ accounts, trades, positions, summary, dividendKrw, cash, cashByAccount, fx, quotedAt }, dividends, indices] = await Promise.all([
    loadPortfolio(userId),
    loadDividends(userId),
    // 지수 시세가 실패해도 대시보드는 그대로 보여 준다
    getIndexMoves().catch((e) => {
      console.error("[market] 지수 조회 실패:", (e as Error).message);
      return [];
    }),
  ]);
  const held = positions.filter((p) => p.quantity > 0);
  const merged = mergeBySymbol(held);

  const href = (symbol: string) => `/stocks/${encodeURIComponent(symbol)}`;
  // 오늘 등락률(전일 종가 대비) 상·하위, 평가손익 상·하위 (종목별로 합친 값, 각 3개)
  const dayRate = (p: (typeof merged)[number]) => (p.price != null && p.previousClose ? p.price / p.previousClose - 1 : null);
  const movers = merged.flatMap((p) => {
    const r = dayRate(p);
    return r == null ? [] : [{ p, r }];
  });
  const dayItem = ({ p, r }: { p: (typeof merged)[number]; r: number }): RankItem => ({ href: href(p.symbol), name: p.name, value: fmtPct(r), sub: fmtSigned(p.dayChangeKrw), t: r });
  const topUp = movers.filter((m) => m.r > 0).sort((a, b) => b.r - a.r).slice(0, 3).map(dayItem);
  const topDown = movers.filter((m) => m.r < 0).sort((a, b) => a.r - b.r).slice(0, 3).map(dayItem);
  const pnlItem = (p: (typeof merged)[number]): RankItem => ({ href: href(p.symbol), name: p.name, value: fmtSigned(p.unrealizedPnlKrw), sub: fmtPct(p.returnRate), t: p.unrealizedPnlKrw });
  const best = merged.filter((p) => p.unrealizedPnlKrw > 0).sort((a, b) => b.unrealizedPnlKrw - a.unrealizedPnlKrw).slice(0, 3).map(pnlItem);
  const worst = merged.filter((p) => p.unrealizedPnlKrw < 0).sort((a, b) => a.unrealizedPnlKrw - b.unrealizedPnlKrw).slice(0, 3).map(pnlItem);
  // 올해 월별 배당 (세후, 원화)
  const year = todayStr().slice(0, 4);
  const thisYear = dividends.filter((d) => d.payDate.startsWith(year));
  const dividendMonths = Array.from({ length: 12 }, (_, i) =>
    thisYear.filter((d) => Number(d.payDate.slice(5, 7)) === i + 1).reduce((s, d) => s + dividendNetKrw(d), 0),
  );

  const sumBy = (keyOf: (p: (typeof held)[number]) => string, labelOf: (k: string) => string) => {
    const m = new Map<string, number>();
    for (const p of held) m.set(keyOf(p), (m.get(keyOf(p)) ?? 0) + p.valueKrw);
    return [...m].map(([key, value]) => ({ key, label: labelOf(key), value }));
  };
  const accountName = new Map(accounts.map((a) => [a.id, a.name]));
  // 현금 (원화 환산). 비중 차트에 '현금' 조각으로 보여 준다
  const cashTotal = Math.max(cashKrw(cash, fx.rate), 0);
  const cashSlice = cashTotal > 0 ? [{ key: "__cash", label: "현금", value: cashTotal }] : [];
  const cashByAcct = [...cashByAccount].map(([id, b]) => ({
    key: id,
    value: Math.max(cashKrw(b, fx.rate), 0),
  }));
  const withCash = (slices: { key: string; label: string; value: number }[]) => [...slices, ...cashSlice];
  return (
    <>
      {/* 대시보드는 보기 전용: 기록 추가·수정은 거래내역·계좌 화면에서 */}
      <PageHeader title="전체 자산" sub={<FxNote fx={fx} quotedAt={quotedAt} />} />
      {trades.length === 0 ? (
        <Welcome accounts={accounts} />
      ) : (
        <div className="space-y-4">
          <SummaryCards summary={summary} dividendKrw={dividendKrw} cash={cash} usdKrw={fx.rate} trend />
          <MarketIndices items={indices} />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <RankCard title="오늘 많이 움직인 종목" columns={[{ label: "상승", items: topUp }, { label: "하락", items: topDown }]} />
            <RankCard title="수익 상위·하위 종목" columns={[{ label: "많이 벌었어요", items: best }, { label: "많이 잃었어요", items: worst }]} />
          </div>
          {thisYear.length > 0 && <DividendMonthly year={year} months={dividendMonths} count={thisYear.length} />}
          {/* 비중: 종목(·시장)과 계좌를 나란히. 보유 종목 표는 종목 화면에서 */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <AllocationChart
              title="종목 비중"
              groups={[
                {
                  id: "stock",
                  label: "종목",
                  slices: withCash(
                    merged.map((p) => ({
                      key: p.symbol,
                      label: p.name,
                      value: p.valueKrw,
                    })),
                  ),
                },
                {
                  id: "market",
                  label: "시장",
                  // 국내(코스피·코스닥)와 해외 두 묶음
                  slices: withCash(
                    sumBy(
                      (p) => (p.market === "US" ? "US" : "KR"),
                      (k) => (k === "US" ? "해외" : "국내"),
                    ),
                  ),
                },
              ]}
            />
            <AllocationChart
              title="계좌 비중"
              groups={[
                {
                  id: "account",
                  label: "계좌",
                  // 계좌별은 그 계좌의 현금까지 더한다
                  slices: (() => {
                    const m = new Map<string, number>();
                    for (const p of held) m.set(p.accountId, (m.get(p.accountId) ?? 0) + p.valueKrw);
                    for (const c of cashByAcct) m.set(c.key, (m.get(c.key) ?? 0) + c.value);
                    return [...m].map(([key, value]) => ({
                      key,
                      label: accountName.get(key) ?? "",
                      value,
                    }));
                  })(),
                },
              ]}
            />
          </div>
        </div>
      )}
    </>
  );
}
