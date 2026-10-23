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
import { getKoreanNames, getQuotes, hasHangul, isKoreanSymbol, localizeStockNames } from "@/lib/market/service";
import { FX_SYMBOL } from "@/lib/performance";
import { computePositions, findOversell, sortTrades } from "@/lib/portfolio";
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
});

export async function saveAccount(_: FormState, form: FormData): Promise<FormState> {
  const userId = await requireUserId();
  const parsed = accountSchema.safeParse({
    name: str(form, "name"),
    broker: str(form, "broker") || undefined,
    memo: str(form, "memo") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
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

  // 저장 후에도 모든 매도가 보유 수량 이내인지 확인
  const existing = await prisma.transaction.findMany({
    where: { accountId: data.accountId, symbol: data.symbol, NOT: id ? { id } : undefined },
  });
  const candidate = {
    ...data,
    id: id || "new",
    tradeDate: data.tradeDate,
    createdAt: new Date().toISOString(),
  };
  if (findOversell([...existing.map(toTrade), candidate])) {
    return { error: "매도 수량이 해당 시점의 보유 수량보다 많아요" };
  }

  const record = { ...data, tradeDate: new Date(`${data.tradeDate}T00:00:00Z`) };
  if (id) {
    await prisma.transaction.update({ where: { id }, data: record });
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
  return { ok: true };
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

  const { rows, errors } = fromCsv(await file.text());
  if (errors.length) {
    return { error: errors.slice(0, 5).join("\n") + (errors.length > 5 ? `\n외 ${errors.length - 5}건` : "") };
  }
  if (rows.length === 0) return { error: "가져올 기록이 없어요" };

  const accounts = await prisma.account.findMany({ where: { userId } });
  const accountId = new Map(accounts.map((a) => [a.name, a.id]));
  const newAccounts = [...new Set(rows.map((r) => r.account))].filter((n) => !accountId.has(n));
  // 검증 단계에서 쓸 임시 ID (저장할 때 실제 ID로 바꾼다)
  newAccounts.forEach((n) => accountId.set(n, `new:${n}`));

  const existing = (await prisma.transaction.findMany({ where: { account: { userId } } })).map(toTrade);
  // 이미 있는 종목은 사용자가 쓰던 이름을 유지한다
  const knownName = new Map(sortTrades(existing).map((t) => [t.symbol, t.name]));
  const englishKr = rows
    .map((r) => normalizeSymbol(r.symbol, r.market))
    .filter((sym, i) => isKoreanSymbol(sym) && !knownName.has(sym) && !hasHangul(rows[i].name));
  const officialName = await getKoreanNames(englishKr).catch(() => new Map<string, string>());
  const keyOf = (t: { accountId: string; tradeDate: string; type: string; symbol: string; quantity: number; price: number }) =>
    [t.accountId, t.tradeDate, t.type, t.symbol, t.quantity, t.price].join("|");
  const seen = new Set(existing.map(keyOf));

  const incoming = rows
    .map((r, i) => ({
      id: `csv-${i}`,
      accountId: accountId.get(r.account)!,
      symbol: normalizeSymbol(r.symbol, r.market),
      name: knownName.get(normalizeSymbol(r.symbol, r.market)) ?? officialName.get(normalizeSymbol(r.symbol, r.market)) ?? r.name,
      market: r.market,
      type: r.type,
      quantity: r.quantity,
      price: r.price,
      fee: r.fee,
      tax: r.tax,
      fxRate: r.fxRate,
      tradeDate: r.tradeDate,
      memo: r.memo || null,
      createdAt: new Date().toISOString(),
    }))
    .filter((t) => {
      const k = keyOf(t);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  const skipped = rows.length - incoming.length;
  if (incoming.length === 0) return { ok: true, message: `새로 추가할 기록이 없어요 (중복 ${skipped}건 건너뜀)` };

  const oversell = findOversell([...existing, ...incoming]);
  if (oversell) {
    return { error: `${oversell.tradeDate} ${oversell.name} 매도 수량이 그 시점 보유 수량보다 많아요` };
  }

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
      })),
    });
  });
  const parts = [`${incoming.length}건 추가`];
  if (skipped) parts.push(`중복 ${skipped}건 건너뜀`);
  if (newAccounts.length) parts.push(`새 계좌 ${newAccounts.join(", ")}`);
  return { ok: true, message: parts.join(" · ") };
}

// ---------- 계정 설정 ----------

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
