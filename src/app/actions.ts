"use server";

import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { signIn, signOut } from "@/auth";
import { fromCsv } from "@/lib/csv";
import { passwordProblem } from "@/lib/password";
import { loadTrades, toTrade } from "@/lib/data";
import { detectKoreanExchange, getKoreanNames, getPriceSeries, getQuotes, hasHangul, isKoreanSymbol, localizeStockNames } from "@/lib/market/service";
import { orderImportRows } from "@/lib/import-order";
import { addDays } from "@/lib/performance";
import { FX_SYMBOL } from "@/lib/performance";
import { fmtQty } from "@/lib/format";
import { readPrefs, type Prefs } from "@/lib/prefs";
import { markDividendsStale } from "@/lib/auto-dividends";
import { computePositions, findOversell, oversellAt, quantityAt, sortTrades, type Trade } from "@/lib/portfolio";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/session";

// 저장 액션은 데이터만 바꾸고 화면은 새로 그리지 않는다(revalidatePath 없음).
// 액션 응답에 화면 다시 그리기가 섞이면 응답이 중간에 끊겨 "처리 중"에서 멈추는 경우가 있어,
// 화면 갱신은 클라이언트가 응답을 받은 뒤 router.refresh()로 따로 한다 (useFormAction 참고).
export interface FormState {
  error?: string;
  ok?: boolean;
  message?: string;
}

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

// ---------- 인증 ----------

const registerSchema = z.object({
  name: z.string().max(50).optional(),
  email: z.email("올바른 이메일을 입력하세요"),
  password: z.string().superRefine((p, ctx) => {
    const problem = passwordProblem(p);
    if (problem) ctx.addIssue({ code: "custom", message: problem });
  }),
});

export async function register(_: FormState, form: FormData): Promise<FormState> {
  const parsed = registerSchema.safeParse({
    name: str(form, "name") || undefined,
    email: str(form, "email").toLowerCase(),
    password: str(form, "password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { email, password, name } = parsed.data;
  if (await prisma.user.findUnique({ where: { email } })) return { error: "이미 가입된 이메일이에요" };
  await prisma.user.create({
    data: {
      email,
      name,
      passwordHash: await bcrypt.hash(password, 10),
      accounts: { create: { name: "기본 계좌" } },
    },
  });
  return login(_, form);
}

export async function login(_: FormState, form: FormData): Promise<FormState> {
  try {
    await signIn("credentials", {
      email: str(form, "email").toLowerCase(),
      password: str(form, "password"),
      redirectTo: "/dashboard",
    });
    return { ok: true };
  } catch (e) {
    if (e instanceof AuthError) return { error: "이메일 또는 비밀번호가 올바르지 않아요" };
    throw e;
  }
}

export async function logout() {
  await signOut({ redirectTo: "/login" });
}

// ---------- 계좌 ----------

const accountSchema = z.object({
  name: z.string().min(1, "계좌 이름을 입력하세요").max(50),
  broker: z.string().max(50).optional(),
  memo: z.string().max(200).optional(),
  kind: z.enum(["GENERAL", "ISA", "PENSION"]).default("GENERAL"),
});

export async function saveAccount(_: FormState, form: FormData): Promise<FormState> {
  const userId = await requireUserId();
  const parsed = accountSchema.safeParse({
    name: str(form, "name"),
    broker: str(form, "broker") || undefined,
    memo: str(form, "memo") || undefined,
    kind: str(form, "kind") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  // 계좌 종류가 바뀌면 자동 배당 세금이 달라진다
  await markDividendsStale(userId);
  const id = str(form, "id");
  if (id) {
    const res = await prisma.account.updateMany({ where: { id, userId }, data: parsed.data });
    if (res.count === 0) return { error: "계좌를 찾을 수 없어요" };
  } else {
    await prisma.account.create({ data: { ...parsed.data, userId } });
  }
  return { ok: true };
}

export async function deleteAccount(id: string) {
  const userId = await requireUserId();
  await prisma.account.deleteMany({ where: { id, userId } });
  revalidatePath("/", "layout");
  redirect("/accounts");
}

// ---------- 매수/매도 기록 ----------

const num = (msg: string) => z.coerce.number({ error: msg });

const txSchema = z.object({
  accountId: z.string().min(1, "계좌를 선택하세요"),
  symbol: z.string().min(1, "종목을 선택하세요").max(20).transform((s) => s.toUpperCase()),
  name: z.string().min(1, "종목명을 입력하세요").max(100),
  market: z.enum(["KOSPI", "KOSDAQ", "US"]),
  type: z.enum(["BUY", "SELL"]),
  quantity: num("수량을 입력하세요").positive("수량은 0보다 커야 해요"),
  price: num("단가를 입력하세요").positive("단가는 0보다 커야 해요"),
  fee: num("수수료가 올바르지 않아요").min(0).default(0),
  tax: num("세금이 올바르지 않아요").min(0).default(0),
  fxRate: num("환율이 올바르지 않아요").positive("환율을 입력하세요"),
  tradeDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "거래일을 입력하세요"),
  memo: z.string().max(200).optional(),
});

/**
 * 매도 초과 오류 메시지. 그 시점 이 계좌의 보유 수량을 알려 주고,
 * 다른 계좌에 충분히 있으면 계좌를 잘못 고른 것일 수 있어 그 계좌 이름도 알려 준다.
 */
function oversellMessage(o: { trade: Trade; held: number }, trades: Trade[], accountName: Map<string, string>) {
  const t = o.trade;
  const elsewhere = [...accountName]
    .filter(([id]) => id !== t.accountId)
    .filter(([id]) => quantityAt(trades.filter((x) => x.accountId === id), t.symbol, t.tradeDate) >= t.quantity - 1e-6)
    .map(([, n]) => `'${n}'`);
  const where = accountName.get(t.accountId) ?? "선택한";
  return (
    `${t.tradeDate} 기준 '${where}' 계좌의 ${t.name} 보유 수량은 ${fmtQty(o.held)}주인데 매도 수량이 ${fmtQty(t.quantity)}주예요.` +
    (elsewhere.length ? ` 이 종목은 ${elsewhere.join(", ")} 계좌에 있어요. 계좌를 확인해 주세요.` : "")
  );
}

/** 코스피/코스닥 종목코드(6자리)를 Yahoo 심볼로 정규화 */
function normalizeSymbol(symbol: string, market: "KOSPI" | "KOSDAQ" | "US") {
  const base = symbol.replace(/\.(KS|KQ)$/, "");
  if (market === "KOSPI") return `${base}.KS`;
  if (market === "KOSDAQ") return `${base}.KQ`;
  return base;
}

export async function saveTransaction(_: FormState, form: FormData): Promise<FormState> {
  const userId = await requireUserId();
  const market = str(form, "market");
  const parsed = txSchema.safeParse({
    accountId: str(form, "accountId"),
    symbol: str(form, "symbol"),
    name: str(form, "name"),
    market,
    type: str(form, "type"),
    quantity: str(form, "quantity").replaceAll(",", ""),
    price: str(form, "price").replaceAll(",", ""),
    fee: str(form, "fee").replaceAll(",", "") || 0,
    tax: str(form, "tax").replaceAll(",", "") || 0,
    fxRate: market === "US" ? str(form, "fxRate").replaceAll(",", "") : 1,
    tradeDate: str(form, "tradeDate"),
    memo: str(form, "memo") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const data = { ...parsed.data, symbol: normalizeSymbol(parsed.data.symbol, parsed.data.market) };

  const account = await prisma.account.findFirst({ where: { id: data.accountId, userId } });
  if (!account) return { error: "계좌를 찾을 수 없어요" };

  const id = str(form, "id");
  if (id && !(await prisma.transaction.findFirst({ where: { id, account: { userId } } }))) {
    return { error: "거래 기록을 찾을 수 없어요" };
  }

  // 저장 후에도 모든 매도가 보유 수량 이내인지 확인 (다른 계좌 안내를 위해 모든 계좌의 같은 종목을 읽는다)
  const sameSymbol = (
    await prisma.transaction.findMany({ where: { account: { userId }, symbol: data.symbol } })
  ).map(toTrade);
  const original = id ? sameSymbol.find((t) => t.id === id) : undefined;
  const candidate: Trade = {
    ...data,
    id: id || "new",
    name: data.name,
    memo: data.memo ?? null,
    // 고칠 때는 원래 순서를 유지해야 같은 날 매수·매도 순서가 뒤바뀌지 않는다
    createdAt: original?.createdAt ?? new Date().toISOString(),
  };
  const others = sameSymbol.filter((t) => t.id !== id);
  const problem = oversellAt([...others.filter((t) => t.accountId === data.accountId), candidate]);
  if (problem) {
    const accounts = await prisma.account.findMany({ where: { userId } });
    return { error: oversellMessage(problem, [...others, candidate], new Map(accounts.map((a) => [a.id, a.name]))) };
  }

  const record = { ...data, tradeDate: new Date(`${data.tradeDate}T00:00:00Z`) };
  if (id) {
    await prisma.transaction.update({ where: { id }, data: record });
    await markDividendsStale(userId);
    // 종목명을 고쳤다면 같은 종목의 다른 기록에도 맞춘다
    await prisma.transaction.updateMany({
      where: { account: { userId }, symbol: data.symbol, NOT: { name: data.name } },
      data: { name: data.name },
    });
  } else {
    // 이미 기록이 있는 종목은 사용자가 정해 둔 이름을 그대로 쓴다 (검색 결과의 긴 영문명으로 바뀌지 않게)
    const named = await prisma.transaction.findFirst({
      where: { account: { userId }, symbol: data.symbol },
      orderBy: { createdAt: "desc" },
      select: { name: true },
    });
    await prisma.transaction.create({ data: { ...record, name: named?.name ?? data.name } });
    await markDividendsStale(userId);
  }
  return { ok: true };
}

export async function deleteTransaction(id: string): Promise<FormState> {
  const userId = await requireUserId();
  const tx = await prisma.transaction.findFirst({ where: { id, account: { userId } } });
  if (!tx) return { error: "거래 기록을 찾을 수 없어요" };
  const rest = await prisma.transaction.findMany({
    where: { accountId: tx.accountId, symbol: tx.symbol, NOT: { id } },
  });
  if (findOversell(rest.map(toTrade))) {
    return { error: "이 매수 기록을 지우면 이후 매도 수량이 보유 수량을 넘어요. 매도 기록을 먼저 삭제해 주세요." };
  }
  await prisma.transaction.delete({ where: { id } });
  await markDividendsStale(userId);
  return { ok: true };
}

// ---------- 배당금 ----------

const dividendSchema = z.object({
  accountId: z.string().min(1, "계좌를 선택하세요"),
  /** "심볼|시장|이름" — 그 계좌에서 거래한 종목 중에서 고른다 */
  stock: z.string().min(1, "종목을 선택하세요"),
  amount: num("배당금을 입력하세요").positive("배당금은 0보다 커야 해요"),
  tax: num("세금이 올바르지 않아요").min(0, "세금이 올바르지 않아요").default(0),
  fxRate: num("환율이 올바르지 않아요").positive("환율을 입력하세요"),
  payDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "지급일을 입력하세요"),
  memo: z.string().max(200).optional(),
});

export async function saveDividend(_: FormState, form: FormData): Promise<FormState> {
  const userId = await requireUserId();
  const market = str(form, "stock").split("|")[1];
  const parsed = dividendSchema.safeParse({
    accountId: str(form, "accountId"),
    stock: str(form, "stock"),
    amount: str(form, "amount").replaceAll(",", ""),
    tax: str(form, "tax").replaceAll(",", "") || 0,
    fxRate: market === "US" ? str(form, "fxRate").replaceAll(",", "") : 1,
    payDate: str(form, "payDate"),
    memo: str(form, "memo") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { stock, ...data } = parsed.data;
  if (data.tax > data.amount) return { error: "세금이 배당금보다 클 수 없어요" };
  const account = await prisma.account.findFirst({ where: { id: data.accountId, userId } });
  if (!account) return { error: "계좌를 찾을 수 없어요" };
  // 종목은 그 계좌에서 거래한 적이 있는 것만 받는다
  const symbol = stock.split("|")[0];
  const traded = await prisma.transaction.findFirst({ where: { accountId: data.accountId, symbol }, orderBy: { tradeDate: "desc" } });
  if (!traded) return { error: "이 계좌에서 거래한 종목만 선택할 수 있어요" };
  const record = {
    ...data,
    symbol,
    name: traded.name,
    market: traded.market,
    payDate: new Date(`${data.payDate}T00:00:00Z`),
  };
  const id = str(form, "id");
  if (id) {
    const own = await prisma.dividend.findFirst({ where: { id, account: { userId } } });
    if (!own) return { error: "배당 기록을 찾을 수 없어요" };
    await prisma.dividend.update({ where: { id }, data: { ...record, auto: false } });
  } else {
    await prisma.dividend.create({ data: record });
  }
  return { ok: true };
}

export async function deleteDividend(id: string): Promise<FormState> {
  const userId = await requireUserId();
  const own = await prisma.dividend.findFirst({ where: { id, account: { userId } } });
  if (!own) return { error: "배당 기록을 찾을 수 없어요" };
  await prisma.$transaction([
    prisma.dividend.delete({ where: { id } }),
    // 자동 배당을 지우면 다시 만들지 않는다
    ...(own.exDate
      ? [
          prisma.dividendSkip.upsert({
            where: { accountId_symbol_exDate: { accountId: own.accountId, symbol: own.symbol, exDate: own.exDate } },
            create: { accountId: own.accountId, symbol: own.symbol, exDate: own.exDate },
            update: {},
          }),
        ]
      : []),
  ]);
  return { ok: true };
}

// ---------- 현금 입출금·환전 ----------

const cashSchema = z.object({
  accountId: z.string().min(1, "계좌를 선택하세요"),
  type: z.enum(["DEPOSIT", "WITHDRAW", "EXCHANGE"]),
  currency: z.enum(["KRW", "USD"]),
  amount: num("금액을 입력하세요").positive("금액은 0보다 커야 해요"),
  fxRate: num("환율이 올바르지 않아요").positive("환율을 입력하세요"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "날짜를 입력하세요"),
  memo: z.string().max(200).optional(),
});

export async function saveCashFlow(_: FormState, form: FormData): Promise<FormState> {
  const userId = await requireUserId();
  const type = str(form, "type");
  const parsed = cashSchema.safeParse({
    accountId: str(form, "accountId"),
    type,
    currency: str(form, "currency"),
    amount: str(form, "amount").replaceAll(",", ""),
    // 환율은 환전에만 쓴다
    fxRate: type === "EXCHANGE" ? str(form, "fxRate").replaceAll(",", "") : 1,
    date: str(form, "date"),
    memo: str(form, "memo") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const data = parsed.data;
  const account = await prisma.account.findFirst({ where: { id: data.accountId, userId } });
  if (!account) return { error: "계좌를 찾을 수 없어요" };
  const record = { ...data, date: new Date(`${data.date}T00:00:00Z`) };
  const id = str(form, "id");
  if (id) {
    const own = await prisma.cashFlow.findFirst({ where: { id, account: { userId } } });
    if (!own) return { error: "현금 기록을 찾을 수 없어요" };
    await prisma.cashFlow.update({ where: { id }, data: record });
  } else {
    await prisma.cashFlow.create({ data: record });
  }
  return { ok: true };
}

export async function deleteCashFlow(id: string): Promise<FormState> {
  const userId = await requireUserId();
  const { count } = await prisma.cashFlow.deleteMany({ where: { id, account: { userId } } });
  return count ? { ok: true } : { error: "현금 기록을 찾을 수 없어요" };
}

// ---------- 시세 ----------

/** 보유 종목과 환율 시세를 다시 받아 온다. 외부 API·DB 부담을 줄이려고 1분 이내 시세는 그대로 쓴다 */
export async function refreshQuotes() {
  const userId = await requireUserId();
  const held = computePositions(await loadTrades(userId)).filter((p) => p.quantity > 0);
  await getQuotes([...held.map((p) => p.symbol), FX_SYMBOL], 60 * 1000);
}

// ---------- CSV 가져오기 ----------

const MAX_IMPORT_BYTES = 2 * 1024 * 1024;

/**
 * CSV로 매매 기록을 한꺼번에 추가한다. 하나라도 잘못되면 아무것도 저장하지 않는다.
 * 없는 계좌는 이름으로 새로 만들고, 이미 있는 기록(같은 계좌·날짜·구분·종목·수량·단가)은 건너뛴다.
 */
export async function importTrades(_: FormState, form: FormData): Promise<FormState> {
  const userId = await requireUserId();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "CSV 파일을 선택하세요" };
  if (file.size > MAX_IMPORT_BYTES) return { error: "파일이 너무 커요 (최대 2MB)" };

  const { rows: parsed, dividends: parsedDivs, cash: parsedCash, errors } = fromCsv(await file.text());
  if (errors.length) {
    return { error: errors.slice(0, 5).join("\n") + (errors.length > 5 ? `\n외 ${errors.length - 5}건` : "") };
  }
  if (parsed.length + parsedDivs.length + parsedCash.length === 0) return { error: "가져올 기록이 없어요" };

  const accounts = await prisma.account.findMany({ where: { userId } });
  const accountId = new Map(accounts.map((a) => [a.name, a.id]));
  const newAccounts = [...new Set([...parsed, ...parsedDivs, ...parsedCash].map((r) => r.account))].filter((n) => !accountId.has(n));
  // 검증 단계에서 쓸 임시 ID (저장할 때 실제 ID로 바꾼다)
  newAccounts.forEach((n) => accountId.set(n, `new:${n}`));

  const existing = (await prisma.transaction.findMany({ where: { account: { userId } } })).map(toTrade);

  // 시장이 "국내"로만 적힌 종목은 거래소(코스피/코스닥)를 찾는다: 기존 기록 → 네이버/Yahoo 순
  const exchangeOf = new Map<string, "KOSPI" | "KOSDAQ" | null>();
  for (const t of existing) if (t.market !== "US") exchangeOf.set(t.symbol.replace(/\.(KS|KQ)$/, ""), t.market);
  const unknownKr = [...new Set(parsed.filter((r) => r.market === "KR" && !exchangeOf.has(r.symbol)).map((r) => r.symbol))];
  await Promise.all(
    unknownKr.map(async (code) => exchangeOf.set(code, (await detectKoreanExchange(code).catch(() => null))?.market ?? null)),
  );
  const unresolved = unknownKr.filter((code) => !exchangeOf.get(code));
  if (unresolved.length) {
    return { error: `거래소를 확인하지 못한 종목이 있어요: ${unresolved.slice(0, 5).join(", ")}\n시장 칸에 코스피/코스닥을 적어 주세요` };
  }
  const rows = parsed.map((r) => ({ ...r, market: r.market === "KR" ? exchangeOf.get(r.symbol)! : r.market }));
  // 이미 있는 종목은 사용자가 쓰던 이름을 유지한다
  const knownName = new Map(sortTrades(existing).map((t) => [t.symbol, t.name]));
  const englishKr = rows
    .map((r) => normalizeSymbol(r.symbol, r.market))
    .filter((sym, i) => isKoreanSymbol(sym) && !knownName.has(sym) && !hasHangul(rows[i].name));
  const officialName = await getKoreanNames(englishKr).catch(() => new Map<string, string>());

  // 미국 주식의 빈 환율은 거래일(휴장일이면 직전 거래일) 원/달러 환율로 채운다
  const fxDates = [
    ...new Set([
      ...rows.filter((r) => r.market === "US" && !r.fxRate).map((r) => r.tradeDate),
      ...parsedDivs.filter((d) => d.market === "US" && !d.fxRate).map((d) => d.payDate),
    ]),
  ];
  const fxOn = new Map<string, number>();
  if (fxDates.length) {
    const from = addDays(fxDates.reduce((m, d) => (d < m ? d : m)), -10);
    const fx = (await getPriceSeries([], from).catch(() => new Map())).get(FX_SYMBOL) as Map<string, number> | undefined;
    const days = fx ? [...fx.keys()].sort() : [];
    for (const d of fxDates) {
      const prev = days.filter((x) => x <= d).at(-1);
      if (prev) fxOn.set(d, fx!.get(prev)!);
    }
    const missing = fxDates.filter((d) => !fxOn.has(d));
    if (missing.length) {
      return { error: `${missing.slice(0, 3).join(", ")} 환율을 불러오지 못했어요. CSV의 환율 칸을 채워 주세요` };
    }
  }

  const keyOf = (t: { accountId: string; tradeDate: string; type: string; symbol: string; quantity: number; price: number }) =>
    [t.accountId, t.tradeDate, t.type, t.symbol, t.quantity, t.price].join("|");
  // 이미 있는 기록은 그 개수만큼만 건너뛴다 (같은 날 같은 가격에 나눠 산 기록도 살린다)
  const existingCount = new Map<string, number>();
  for (const t of existing) existingCount.set(keyOf(t), (existingCount.get(keyOf(t)) ?? 0) + 1);

  const candidates = rows
    .map((r, i) => {
      const symbol = normalizeSymbol(r.symbol, r.market);
      return {
        id: `csv-${i}`,
        accountId: accountId.get(r.account)!,
        symbol,
        name: knownName.get(symbol) ?? officialName.get(symbol) ?? r.name,
        market: r.market,
        type: r.type,
        quantity: r.quantity,
        price: r.price,
        fee: r.fee,
        tax: r.tax,
        fxRate: r.market === "US" ? r.fxRate || fxOn.get(r.tradeDate)! : 1,
        tradeDate: r.tradeDate,
        memo: r.memo || null,
      };
    })
    .filter((t) => {
      const k = keyOf(t);
      const left = existingCount.get(k) ?? 0;
      if (left > 0) {
        existingCount.set(k, left - 1);
        return false;
      }
      return true;
    });
  // 배당: 그 계좌에서 거래한(기존 또는 이번 파일) 종목만. 종목코드로 저장된 심볼을 찾는다
  const tradedIn = new Map<string, { symbol: string; name: string; market: Trade["market"] }>();
  for (const t of [...existing, ...candidates]) tradedIn.set(`${t.accountId}|${t.symbol.replace(/\.(KS|KQ)$/, "")}`, t);
  const [existingDivs, existingCash] = await Promise.all([
    prisma.dividend.findMany({ where: { account: { userId } } }),
    prisma.cashFlow.findMany({ where: { account: { userId } } }),
  ]);
  const countOf = (keys: string[]) => {
    const m = new Map<string, number>();
    for (const k of keys) m.set(k, (m.get(k) ?? 0) + 1);
    return m;
  };
  const takeNew = <T,>(items: T[], keyOf: (x: T) => string, have: Map<string, number>) =>
    items.filter((x) => {
      const left = have.get(keyOf(x)) ?? 0;
      if (left > 0) {
        have.set(keyOf(x), left - 1);
        return false;
      }
      return true;
    });
  const divProblems: string[] = [];
  const divRows = parsedDivs.flatMap((d) => {
    const acct = accountId.get(d.account)!;
    const t = tradedIn.get(`${acct}|${d.symbol}`);
    if (!t) {
      divProblems.push(`${d.payDate} ${d.name || d.symbol}: '${d.account}' 계좌에서 거래한 종목이 아니에요`);
      return [];
    }
    return [{ accountId: acct, symbol: t.symbol, name: t.name, market: t.market, amount: d.amount, tax: d.tax, fxRate: t.market === "US" ? d.fxRate || fxOn.get(d.payDate)! : 1, payDate: d.payDate, memo: d.memo || null }];
  });
  if (divProblems.length) return { error: `배당 기록을 가져올 수 없어요\n${divProblems.slice(0, 5).join("\n")}` };
  const divKey = (d: { accountId: string; payDate: string; symbol: string; amount: number }) => [d.accountId, d.payDate, d.symbol, d.amount].join("|");
  const newDivs = takeNew(
    divRows,
    divKey,
    countOf(existingDivs.map((d) => divKey({ accountId: d.accountId, payDate: d.payDate.toISOString().slice(0, 10), symbol: d.symbol, amount: Number(d.amount) }))),
  );
  const cashKey = (c: { accountId: string; date: string; type: string; currency: string; amount: number }) => [c.accountId, c.date, c.type, c.currency, c.amount].join("|");
  const cashRows = parsedCash.map((c) => ({ accountId: accountId.get(c.account)!, type: c.type, currency: c.currency, amount: c.amount, fxRate: c.fxRate, date: c.date, memo: c.memo || null }));
  const newCash = takeNew(
    cashRows,
    cashKey,
    countOf(existingCash.map((c) => cashKey({ accountId: c.accountId, date: c.date.toISOString().slice(0, 10), type: c.type, currency: c.currency, amount: Number(c.amount) }))),
  );

  const skipped = rows.length - candidates.length + (divRows.length - newDivs.length) + (cashRows.length - newCash.length);
  if (candidates.length + newDivs.length + newCash.length === 0) return { ok: true, message: `새로 추가할 기록이 없어요 (중복 ${skipped}건 건너뜀)` };

  // 같은 날짜 안의 실제 거래 순서를 찾는다 (증권사 파일은 보통 최신순)
  const ordered = candidates.length ? orderImportRows(existing, candidates) : { rows: [] as (typeof candidates[number] & { createdAt: string })[], oversell: null };
  if (!ordered.rows) {
    const all = [...existing, ...candidates.map((c, i) => ({ ...c, createdAt: new Date(i).toISOString() }))];
    const o = oversellAt(all.filter((t) => t.accountId === ordered.oversell.accountId && t.symbol === ordered.oversell.symbol));
    const name = new Map([...accountId].map(([n, id]) => [id, n]));
    return { error: o ? oversellMessage(o, all, name) : `${ordered.oversell.tradeDate} ${ordered.oversell.name} 매도 수량이 그 시점 보유 수량보다 많아요` };
  }
  const incoming = ordered.rows;

  await prisma.$transaction(async (tx) => {
    for (const name of newAccounts) {
      const a = await tx.account.create({ data: { userId, name } });
      accountId.set(name, a.id);
    }
    const realId = new Map(newAccounts.map((n) => [`new:${n}`, accountId.get(n)!]));
    await tx.transaction.createMany({
      data: incoming.map((t) => ({
        accountId: realId.get(t.accountId) ?? t.accountId,
        symbol: t.symbol,
        name: t.name,
        market: t.market,
        type: t.type,
        quantity: t.quantity,
        price: t.price,
        fee: t.fee,
        tax: t.tax,
        fxRate: t.fxRate,
        memo: t.memo,
        tradeDate: new Date(`${t.tradeDate}T00:00:00Z`),
        createdAt: new Date(t.createdAt),
      })),
    });
    await tx.dividend.createMany({
      data: newDivs.map((d) => ({ ...d, accountId: realId.get(d.accountId) ?? d.accountId, payDate: new Date(`${d.payDate}T00:00:00Z`) })),
    });
    await tx.cashFlow.createMany({
      data: newCash.map((c) => ({ ...c, accountId: realId.get(c.accountId) ?? c.accountId, date: new Date(`${c.date}T00:00:00Z`) })),
    });
  });
  await markDividendsStale(userId);
  const parts = [`${incoming.length + newDivs.length + newCash.length}건 추가`];
  if (newDivs.length || newCash.length) parts[0] += ` (매매 ${incoming.length} · 배당 ${newDivs.length} · 현금 ${newCash.length})`;
  if (skipped) parts.push(`중복 ${skipped}건 건너뜀`);
  if (newAccounts.length) parts.push(`새 계좌 ${newAccounts.join(", ")}`);
  return { ok: true, message: parts.join(" · ") };
}

// ---------- 계정 설정 ----------

/** 목록 정렬 등 화면 설정 저장 (설정 화면에서 바꿀 때마다 호출) */
export async function savePrefs(patch: Partial<Prefs>): Promise<FormState> {
  const userId = await requireUserId();
  // 바꾼 항목만 받아 저장된 설정에 합친다 (설정 화면의 여러 칸이 서로 덮어쓰지 않도록)
  const current = readPrefs((await prisma.user.findUnique({ where: { id: userId }, select: { prefs: true } }))?.prefs);
  const { cashSince: _ignored, ...rest } = patch;
  void _ignored;
  const next: Prefs = { ...current, ...rest };
  // 매매와 연동은 켠 순간부터: 그 뒤에 기록한 매수·매도·배당만 현금에 반영한다 (끄면 시작 시각도 지운다)
  if (rest.cash === "linked" && current.cash !== "linked") next.cashSince = new Date().toISOString();
  if (next.cash !== "linked") delete next.cashSince;
  await prisma.user.update({ where: { id: userId }, data: { prefs: JSON.parse(JSON.stringify(readPrefs(next))) } });
  return { ok: true };
}

export async function updateProfile(_: FormState, form: FormData): Promise<FormState> {
  const userId = await requireUserId();
  const name = str(form, "name");
  if (name.length > 50) return { error: "이름은 50자 이하로 입력하세요" };
  // 이름은 다른 화면에 표시되지 않으므로 화면 전체를 다시 그리지 않는다
  await prisma.user.update({ where: { id: userId }, data: { name: name || null } });
  return { ok: true, message: "저장했어요" };
}

const passwordSchema = z
  .object({
    current: z.string().min(1, "현재 비밀번호를 입력하세요"),
    next: z.string().superRefine((p, ctx) => {
      const problem = passwordProblem(p);
      if (problem) ctx.addIssue({ code: "custom", message: problem.replace("비밀번호는", "새 비밀번호는") });
    }),
    confirm: z.string(),
  })
  .refine((v) => v.next === v.confirm, { message: "새 비밀번호가 서로 달라요" });

export async function changePassword(_: FormState, form: FormData): Promise<FormState> {
  const userId = await requireUserId();
  const parsed = passwordSchema.safeParse({ current: str(form, "current"), next: str(form, "next"), confirm: str(form, "confirm") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !(await bcrypt.compare(parsed.data.current, user.passwordHash))) {
    return { error: "현재 비밀번호가 올바르지 않아요" };
  }
  await prisma.user.update({ where: { id: userId }, data: { passwordHash: await bcrypt.hash(parsed.data.next, 10) } });
  return { ok: true, message: "비밀번호를 변경했어요" };
}

// ---------- 종목명 변경 ----------

/** 내 모든 계좌에서 이 종목의 표시 이름을 바꾼다 */
export async function renameStock(_: FormState, form: FormData): Promise<FormState> {
  const userId = await requireUserId();
  const symbol = str(form, "symbol");
  const name = str(form, "name");
  if (!name) return { error: "종목명을 입력하세요" };
  if (name.length > 100) return { error: "종목명은 100자 이하로 입력하세요" };
  const res = await prisma.transaction.updateMany({ where: { account: { userId }, symbol }, data: { name } });
  if (res.count === 0) return { error: "종목을 찾을 수 없어요" };
  return { ok: true };
}

/** 모든 국내 종목 이름을 증권사 표기 한글 이름으로 바꾼다 (직접 정한 이름 포함) */
export async function localizeAllStockNames(): Promise<FormState> {
  const userId = await requireUserId();
  const changed = await localizeStockNames(userId, { all: true });
  return { ok: true, message: changed ? `${changed}개 종목 이름을 바꿨어요` : "바꿀 종목이 없어요" };
}
