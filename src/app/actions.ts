"use server";

import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { signIn, signOut } from "@/auth";
import { loadTrades, toTrade } from "@/lib/data";
import { getQuotes } from "@/lib/market/service";
import { FX_SYMBOL } from "@/lib/performance";
import { computePositions, findOversell } from "@/lib/portfolio";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/session";

export interface FormState {
  error?: string;
  ok?: boolean;
}

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

// ---------- 인증 ----------

const registerSchema = z.object({
  name: z.string().max(50).optional(),
  email: z.email("올바른 이메일을 입력하세요"),
  password: z.string().min(8, "비밀번호는 8자 이상이어야 합니다"),
});

export async function register(_: FormState, form: FormData): Promise<FormState> {
  const parsed = registerSchema.safeParse({
    name: str(form, "name") || undefined,
    email: str(form, "email").toLowerCase(),
    password: str(form, "password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { email, password, name } = parsed.data;
  if (await prisma.user.findUnique({ where: { email } })) return { error: "이미 가입된 이메일입니다" };
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
    if (e instanceof AuthError) return { error: "이메일 또는 비밀번호가 올바르지 않습니다" };
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
    if (res.count === 0) return { error: "계좌를 찾을 수 없습니다" };
  } else {
    await prisma.account.create({ data: { ...parsed.data, userId } });
  }
  revalidatePath("/", "layout");
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
  quantity: num("수량을 입력하세요").positive("수량은 0보다 커야 합니다"),
  price: num("단가를 입력하세요").positive("단가는 0보다 커야 합니다"),
  fee: num("수수료가 올바르지 않습니다").min(0).default(0),
  tax: num("세금이 올바르지 않습니다").min(0).default(0),
  fxRate: num("환율이 올바르지 않습니다").positive("환율을 입력하세요"),
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
  if (!account) return { error: "계좌를 찾을 수 없습니다" };

  const id = str(form, "id");
  if (id && !(await prisma.transaction.findFirst({ where: { id, account: { userId } } }))) {
    return { error: "거래 기록을 찾을 수 없습니다" };
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
    return { error: "매도 수량이 해당 시점의 보유 수량보다 많습니다" };
  }

  const record = { ...data, tradeDate: new Date(`${data.tradeDate}T00:00:00Z`) };
  if (id) await prisma.transaction.update({ where: { id }, data: record });
  else await prisma.transaction.create({ data: record });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteTransaction(id: string): Promise<FormState> {
  const userId = await requireUserId();
  const tx = await prisma.transaction.findFirst({ where: { id, account: { userId } } });
  if (!tx) return { error: "거래 기록을 찾을 수 없습니다" };
  const rest = await prisma.transaction.findMany({
    where: { accountId: tx.accountId, symbol: tx.symbol, NOT: { id } },
  });
  if (findOversell(rest.map(toTrade))) {
    return { error: "이 매수 기록을 지우면 이후 매도 수량이 보유 수량을 넘습니다. 매도 기록을 먼저 삭제하세요." };
  }
  await prisma.transaction.delete({ where: { id } });
  revalidatePath("/", "layout");
  return { ok: true };
}

// ---------- 시세 ----------

/** 보유 종목과 환율 시세를 다시 받아 온다. 외부 API·DB 부담을 줄이려고 1분 이내 시세는 그대로 쓴다 */
export async function refreshQuotes() {
  const userId = await requireUserId();
  const held = computePositions(await loadTrades(userId)).filter((p) => p.quantity > 0);
  await getQuotes([...held.map((p) => p.symbol), FX_SYMBOL], 60 * 1000);
  revalidatePath("/", "layout");
}
