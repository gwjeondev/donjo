// 자동 배당 기록을 DB에 맞춘다: 배당 이력 × 보유 수량으로 계산한 목록과 비교해 만들고, 고치고, 지운다.
//  - 사용자가 고친 자동 배당(auto=false)과 지운 자동 배당(DividendSkip)은 다시 건드리지 않는다
//  - 직접 넣은 배당이 그 배당락일 근처에 있으면 같은 배당으로 보고 만들지 않는다
import "server-only";
import { prisma } from "./db";
import { computeAutoDividends, type AccountKind } from "./autodiv";
import { getDividendEvents, getPriceSeries, todayStr } from "./market/service";
import { addDays, FX_SYMBOL } from "./performance";
import { sortTrades } from "./portfolio";
// data.ts도 이 파일을 쓰지만, toTrade는 호출할 때만 쓰므로 순환 import가 문제되지 않는다
import { toTrade } from "./data";

const toDate = (d: string) => new Date(`${d}T00:00:00Z`);
const day = (d: Date) => d.toISOString().slice(0, 10);

const kstDay = (d: Date) => new Date(d.getTime() + 9 * 3600_000).toISOString().slice(0, 10);

// 같은 서버에서 동시에 여러 번 불려도 한 번만 (대시보드는 자산·수익률을 동시에 읽는다)
const running = new Map<string, Promise<void>>();

/**
 * 자동 배당 맞추기. 하루(한국 날짜)에 한 번만 하고, 매매·계좌 종류가 바뀌면 다음 조회 때 바로 한다.
 * 화면을 열 때는 마지막으로 맞춘 시각 하나만 읽는다.
 */
export function syncAutoDividends(userId: string): Promise<void> {
  const inflight = running.get(userId);
  if (inflight) return inflight;
  const p = (async () => {
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { dividendsSyncedAt: true } });
    if (u?.dividendsSyncedAt && kstDay(u.dividendsSyncedAt) === kstDay(new Date())) return;
    await sync(userId);
    await prisma.user.update({ where: { id: userId }, data: { dividendsSyncedAt: new Date() } });
  })()
    .catch((e) => console.error("[dividends] 자동 배당 갱신 실패:", (e as Error).message))
    .finally(() => running.delete(userId));
  running.set(userId, p);
  return p;
}

/** 매매·계좌 종류가 바뀌면 다음 조회 때 다시 맞추도록 표시만 해 둔다 */
export async function markDividendsStale(userId: string) {
  await prisma.user.update({ where: { id: userId }, data: { dividendsSyncedAt: null } });
}

async function sync(userId: string) {
  const [accounts, rows, dividends, skips] = await Promise.all([
    prisma.account.findMany({ where: { userId }, select: { id: true, kind: true } }),
    prisma.transaction.findMany({ where: { account: { userId } } }),
    prisma.dividend.findMany({ where: { account: { userId } } }),
    prisma.dividendSkip.findMany({ where: { account: { userId } } }),
  ]);
  const trades = sortTrades(rows.map(toTrade));
  const existingAuto = dividends.filter((d) => d.auto);
  if (trades.length === 0 && existingAuto.length === 0) return;

  const events = await getDividendEvents([...new Set(trades.map((t) => t.symbol))]);
  // 미국 배당 원화 환산용 환율 (미국 종목에 배당 이력이 있을 때만 받는다)
  const usFrom = trades.filter((t) => t.market === "US" && events.get(t.symbol)?.length).map((t) => t.tradeDate).sort()[0];
  const fx = usFrom ? (await getPriceSeries([], usFrom)).get(FX_SYMBOL) : undefined;
  const fxDates = fx ? [...fx.keys()].sort() : [];
  const fxOn = (date: string) => {
    let lo = 0;
    let hi = fxDates.length - 1;
    let hit = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (fxDates[mid] <= date) {
        hit = mid;
        lo = mid + 1;
      } else hi = mid - 1;
    }
    return hit >= 0 ? fx!.get(fxDates[hit])! : null;
  };

  const desired = computeAutoDividends({
    trades,
    events,
    kinds: new Map(accounts.map((a) => [a.id, a.kind as AccountKind])),
    fxOn,
    today: todayStr(),
  });

  const skipped = new Set(skips.map((s) => `${s.accountId}|${s.symbol}|${day(s.exDate)}`));
  // 직접 넣은(또는 고친) 배당: 배당락일 7일 전 ~ 150일 뒤에 지급일이 있으면 같은 배당으로 본다
  const manual = dividends.filter((d) => !d.auto);
  const coveredByManual = (a: { accountId: string; symbol: string; exDate: string }) =>
    manual.some(
      (m) =>
        m.accountId === a.accountId &&
        m.symbol === a.symbol &&
        (m.exDate ? day(m.exDate) === a.exDate : day(m.payDate) >= addDays(a.exDate, -7) && day(m.payDate) <= addDays(a.exDate, 150)),
    );
  const want = new Map(
    desired.filter((d) => !skipped.has(`${d.accountId}|${d.symbol}|${d.exDate}`) && !coveredByManual(d)).map((d) => [`${d.accountId}|${d.symbol}|${d.exDate}`, d]),
  );
  const have = new Map(existingAuto.map((d) => [`${d.accountId}|${d.symbol}|${d.exDate ? day(d.exDate) : ""}`, d]));

  const remove = existingAuto.filter((d) => !want.has(`${d.accountId}|${d.symbol}|${d.exDate ? day(d.exDate) : ""}`)).map((d) => d.id);
  const create = [...want.entries()].filter(([k]) => !have.has(k)).map(([, d]) => d);
  const update = [...want.entries()].flatMap(([k, d]) => {
    const h = have.get(k);
    if (!h) return [];
    const same =
      Number(h.amount) === d.amount && Number(h.tax) === d.tax && Number(h.fxRate) === d.fxRate && day(h.payDate) === d.payDate && h.name === d.name;
    return same ? [] : [{ id: h.id, d }];
  });
  if (!remove.length && !create.length && !update.length) return;

  await prisma.$transaction([
    prisma.dividend.deleteMany({ where: { id: { in: remove } } }),
    prisma.dividend.createMany({
      data: create.map((d) => ({
        accountId: d.accountId,
        symbol: d.symbol,
        name: d.name,
        market: d.market,
        amount: d.amount,
        tax: d.tax,
        fxRate: d.fxRate,
        payDate: toDate(d.payDate),
        exDate: toDate(d.exDate),
        auto: true,
      })),
      skipDuplicates: true,
    }),
    ...update.map(({ id, d }) =>
      prisma.dividend.update({ where: { id }, data: { name: d.name, amount: d.amount, tax: d.tax, fxRate: d.fxRate, payDate: toDate(d.payDate) } }),
    ),
  ]);
}
