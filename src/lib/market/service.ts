// 시세 조회 + DB 캐시. 외부 API 장애 시 마지막으로 저장된 값을 사용한다.
import "server-only";
import { prisma } from "../db";
import { addDays, FX_SYMBOL, type PriceSeries } from "../performance";
import { koreanSource, provider } from ".";
import type { Quote } from "./types";

const QUOTE_TTL_MS = 10 * 60 * 1000;
/** 외부 시세를 동시에 몇 종목씩 받을지 */
const QUOTE_CONCURRENCY = 8;
const BARS_TTL_MS = 6 * 60 * 60 * 1000;
const DEFAULT_USD_KRW = 1350;

const toDate = (d: string) => new Date(`${d}T00:00:00Z`);
const fromDate = (d: Date) => d.toISOString().slice(0, 10);
const todayStr = () => fromDate(new Date());

/** 종목 시세. maxAgeMs보다 오래된 캐시만 외부에서 다시 받는다 */
export async function getQuotes(symbols: string[], maxAgeMs = QUOTE_TTL_MS): Promise<Map<string, Quote>> {
  const unique = [...new Set(symbols)];
  if (unique.length === 0) return new Map();
  // DB 캐시 조회가 실패해도 화면이 깨지지 않게 외부 시세로만 진행한다
  const cached = await prisma.symbolCache.findMany({ where: { symbol: { in: unique } } }).catch((e) => {
    console.error("[market] 시세 캐시 조회 실패:", (e as Error).message);
    return [];
  });
  const bySymbol = new Map(cached.map((c) => [c.symbol, c]));
  const now = Date.now();

  // 오래된 종목만 외부에서 받는다 (동시에 몇 개씩만)
  const stale = unique.filter((symbol) => {
    const at = bySymbol.get(symbol)?.quoteFetchedAt;
    return !at || now - at.getTime() >= maxAgeMs;
  });
  const fetched = new Map<string, Quote>();
  const failed: string[] = [];
  for (let i = 0; i < stale.length; i += QUOTE_CONCURRENCY) {
    await Promise.all(
      stale.slice(i, i + QUOTE_CONCURRENCY).map(async (symbol) => {
        try {
          fetched.set(symbol, { ...(await provider.quote(symbol)), fetchedAt: new Date() });
        } catch (e) {
          failed.push(symbol);
          console.warn(`[market] quote 실패 ${symbol}:`, (e as Error).message);
        }
      }),
    );
  }
  // 저장은 한 번에 묶어서 (종목마다 따로 저장하면 DB 연결을 한꺼번에 많이 잡아 연결 대기 시간 초과가 난다).
  // 실패한 종목(상장폐지 등)도 시각만 남겨, 캐시 유효 시간 동안은 다시 묻지 않는다
  if (fetched.size || failed.length) {
    const at = new Date();
    await prisma
      .$transaction([
        ...[...fetched.values()].map((q) =>
          prisma.symbolCache.upsert({
            where: { symbol: q.symbol },
            create: { symbol: q.symbol, price: q.price, previousClose: q.previousClose, currency: q.currency, quoteFetchedAt: at },
            update: { price: q.price, previousClose: q.previousClose, currency: q.currency, quoteFetchedAt: at },
          }),
        ),
        ...failed.map((symbol) => prisma.symbolCache.upsert({ where: { symbol }, create: { symbol, quoteFetchedAt: at }, update: { quoteFetchedAt: at } })),
      ])
      .catch((e) => console.error("[market] 시세 캐시 저장 실패:", (e as Error).message));
  }

  const results = unique.map((symbol): Quote | null => {
    const q = fetched.get(symbol);
    if (q) return q;
    const c = bySymbol.get(symbol);
    if (c?.price == null) return null;
    return { symbol, price: Number(c.price), previousClose: c.previousClose == null ? null : Number(c.previousClose), currency: c.currency, fetchedAt: c.quoteFetchedAt ?? undefined };
  });
  return new Map(results.filter((q): q is Quote => q !== null).map((q) => [q.symbol, q]));
}

/** 시세 묶음에서 원달러 환율을 꺼낸다 (시세와 환율을 한 번에 조회하려고) */
export function usdKrwFrom(quotes: Map<string, Quote>): { rate: number; live: boolean } {
  const q = quotes.get(FX_SYMBOL);
  return q ? { rate: q.price, live: true } : { rate: DEFAULT_USD_KRW, live: false };
}

export async function getUsdKrw(): Promise<{ rate: number; live: boolean }> {
  return usdKrwFrom(await getQuotes([FX_SYMBOL]));
}

/** 한 번에 몇 종목씩 외부 시세를 받아 저장할지 (DB·외부 API에 동시에 몰리지 않게) */
const REFRESH_CONCURRENCY = 3;

/**
 * 일봉 캐시를 갱신한다. 캐시 상태는 종목 수와 상관없이 쿼리 2번으로 확인하고,
 * 오래된 종목만 외부에서 받아(마지막 저장일 1주 전부터, 수정 종가 반영) 저장한다.
 */
async function refreshBars(symbols: string[], from: string, doneAt?: Map<string, string>) {
  const [caches, ranges] = await Promise.all([
    prisma.symbolCache.findMany({ where: { symbol: { in: symbols } }, select: { symbol: true, barsFetchedAt: true } }),
    prisma.priceBar.groupBy({ by: ["symbol"], where: { symbol: { in: symbols } }, _min: { date: true }, _max: { date: true } }),
  ]);
  const fetchedAt = new Map(caches.map((c) => [c.symbol, c.barsFetchedAt]));
  const range = new Map(ranges.map((r) => [r.symbol, r]));

  const jobs = symbols.flatMap((symbol) => {
    const r = range.get(symbol);
    const hasEarliest = !!r?._min.date && fromDate(r._min.date) <= from;
    const at = fetchedAt.get(symbol);
    // 다 판 종목: 마지막 보유일까지 일봉이 있으면 지난 가격은 바뀌지 않으니 다시 받지 않는다
    const done = doneAt?.get(symbol);
    if (done && hasEarliest && r?._max.date && fromDate(r._max.date) >= done) return [];
    // 최근에 받았으면 건너뛴다 (받아 둔 일봉이 아예 없는데 최근에 시도했다면 받을 수 없는 종목이다)
    if (at && Date.now() - at.getTime() < BARS_TTL_MS && (hasEarliest || !r)) return [];
    return [{ symbol, start: hasEarliest && r?._max.date ? addDays(fromDate(r._max.date), -7) : from }];
  });

  for (let i = 0; i < jobs.length; i += REFRESH_CONCURRENCY) {
    await Promise.all(
      jobs.slice(i, i + REFRESH_CONCURRENCY).map(async ({ symbol, start }) => {
        try {
          const bars = await provider.history(symbol, start);
          await prisma.$transaction([
            prisma.priceBar.deleteMany({ where: { symbol, date: { gte: toDate(start) } } }),
            prisma.priceBar.createMany({
              data: bars.map((b) => ({ symbol, date: toDate(b.date), close: b.close })),
              skipDuplicates: true,
            }),
            prisma.symbolCache.upsert({
              where: { symbol },
              create: { symbol, barsFetchedAt: new Date() },
              update: { barsFetchedAt: new Date() },
            }),
          ]);
        } catch (e) {
          console.warn(`[market] history 실패 ${symbol}:`, (e as Error).message);
          // 일봉도 실패하면 시각을 남겨 캐시 유효 시간 동안 다시 묻지 않는다
          await prisma.symbolCache
            .upsert({ where: { symbol }, create: { symbol, barsFetchedAt: new Date() }, update: { barsFetchedAt: new Date() } })
            .catch(() => {});
        }
      }),
    );
  }
}

/**
 * 일봉 시세. doneAt: 더 이상 보유하지 않는 종목의 마지막 보유일 (그날까지 일봉이 저장돼 있으면 다시 받지 않는다)
 */
export async function getPriceSeries(symbols: string[], from: string, doneAt?: Map<string, string>): Promise<PriceSeries> {
  const unique = [...new Set([...symbols, FX_SYMBOL])];
  // 갱신이 실패해도 이미 저장된 일봉으로 계산한다
  await refreshBars(unique, from, doneAt).catch((e) => console.error("[market] 일봉 갱신 실패:", (e as Error).message));
  const bars = await prisma.priceBar.findMany({
    where: { symbol: { in: unique }, date: { gte: toDate(addDays(from, -10)) } },
    orderBy: { date: "asc" },
  });
  const series: PriceSeries = new Map();
  for (const b of bars) {
    if (!series.has(b.symbol)) series.set(b.symbol, new Map());
    series.get(b.symbol)!.set(fromDate(b.date), Number(b.close));
  }
  return series;
}

/** 특정 날짜의 원달러 환율 (거래 입력 시 기본값) */
export async function getUsdKrwOn(date: string): Promise<number | null> {
  if (date >= todayStr()) return (await getUsdKrw()).rate;
  const series = await getPriceSeries([], addDays(date, -7));
  const fx = series.get(FX_SYMBOL);
  if (!fx) return null;
  const dates = [...fx.keys()].filter((d) => d <= date).sort();
  return dates.length ? fx.get(dates.at(-1)!)! : null;
}

export { todayStr };

// ---------- 국내 종목 한글 이름 ----------

const NAME_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/** 조회 실패 시 하루 뒤 다시 시도하도록 기록 시각을 당겨 둔다 */
const NAME_RETRY_MS = 24 * 60 * 60 * 1000;

export const isKoreanSymbol = (symbol: string) => /\.(KS|KQ)$/.test(symbol);

/** 국내 종목의 증권사 표기 이름 (DB 캐시, 30일마다 갱신). 못 구한 종목은 결과에 없다 */
export async function getKoreanNames(symbols: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(symbols.filter(isKoreanSymbol))];
  if (unique.length === 0) return new Map();
  const cached = await prisma.symbolCache.findMany({
    where: { symbol: { in: unique } },
    select: { symbol: true, name: true, nameFetchedAt: true },
  });
  const names = new Map(cached.flatMap((c) => (c.name ? [[c.symbol, c.name] as const] : [])));
  const fetchedAt = new Map(cached.map((c) => [c.symbol, c.nameFetchedAt]));
  const stale = unique.filter((s) => {
    const at = fetchedAt.get(s);
    return !at || Date.now() - at.getTime() > NAME_TTL_MS;
  });

  for (let i = 0; i < stale.length; i += REFRESH_CONCURRENCY) {
    await Promise.all(
      stale.slice(i, i + REFRESH_CONCURRENCY).map(async (symbol) => {
        let name: string | null = null;
        try {
          name = (await koreanSource.lookup(symbol.slice(0, -3)))?.name ?? null;
        } catch (e) {
          console.warn(`[market] 한글 이름 조회 실패 ${symbol}:`, (e as Error).message);
        }
        const at = name ? new Date() : new Date(Date.now() - NAME_TTL_MS + NAME_RETRY_MS);
        await prisma.symbolCache
          .upsert({
            where: { symbol },
            create: { symbol, name, nameFetchedAt: at },
            update: { ...(name ? { name } : {}), nameFetchedAt: at },
          })
          .catch(() => {});
        if (name) names.set(symbol, name);
      }),
    );
  }
  return names;
}

const hasHangul = (s: string) => /[가-힣]/.test(s);

/**
 * 사용자의 국내 종목 이름을 증권사 표기 한글 이름으로 바꾼다.
 * 기본은 영문 이름(Yahoo 등에서 온 이름)만 바꾸고, 사용자가 정한 한글 이름은 그대로 둔다. all이면 전부 바꾼다.
 * @returns 바꾼 종목 수
 */
export async function localizeStockNames(userId: string, { all = false } = {}): Promise<number> {
  const rows = await prisma.transaction.findMany({
    where: { account: { userId }, market: { in: ["KOSPI", "KOSDAQ"] } },
    distinct: ["symbol", "name"],
    select: { symbol: true, name: true },
  });
  // 종목별로 바꿀 대상 이름 목록 (all이 아니면 한글이 없는 이름만)
  const replace = new Map<string, string[]>();
  for (const r of rows) {
    if (!all && hasHangul(r.name)) continue;
    replace.set(r.symbol, [...(replace.get(r.symbol) ?? []), r.name]);
  }
  if (replace.size === 0) return 0;
  const official = await getKoreanNames([...replace.keys()]);
  let changed = 0;
  for (const [symbol, name] of official) {
    const from = (replace.get(symbol) ?? []).filter((n) => n !== name);
    if (from.length === 0) continue;
    const res = await prisma.transaction.updateMany({
      where: { account: { userId }, symbol, name: { in: from } },
      data: { name },
    });
    if (res.count) changed++;
  }
  return changed;
}

export { hasHangul };

/**
 * 국내 종목코드의 거래소(코스피/코스닥)를 찾는다. 시세 조회(Yahoo .KS/.KQ)에 필요하다.
 * 네이버 → 실패 시 Yahoo 시세가 있는 쪽으로 판별. 못 찾으면 market은 null.
 */
export async function detectKoreanExchange(code: string): Promise<{ market: "KOSPI" | "KOSDAQ" | null; name: string | null }> {
  const info = await koreanSource.lookup(code).catch(() => null);
  if (info?.market === "KOSPI" || info?.market === "KOSDAQ") return { market: info.market, name: info.name };
  for (const [suffix, market] of [["KS", "KOSPI"], ["KQ", "KOSDAQ"]] as const) {
    const ok = await provider.quote(`${code}.${suffix}`).then(
      () => true,
      () => false,
    );
    if (ok) return { market, name: info?.name ?? null };
  }
  return { market: null, name: info?.name ?? null };
}
