import { auth } from "@/auth";
import { toCsv } from "@/lib/csv";
import { loadCashFlows, loadDividends, loadTrades } from "@/lib/data";
import { prisma } from "@/lib/db";
import { sortTrades } from "@/lib/portfolio";

/** 거래내역 CSV 다운로드: 매매·배당·입출금 (?account=계좌ID 로 한 계좌만) */
export async function GET(req: Request) {
  const userId = (await auth())?.user?.id;
  if (!userId) return new Response("unauthorized", { status: 401 });
  const account = new URL(req.url).searchParams.get("account") ?? undefined;
  const [accounts, trades, dividends, cash] = await Promise.all([
    prisma.account.findMany({ where: { userId }, select: { id: true, name: true } }),
    loadTrades(userId, account),
    loadDividends(userId, account),
    loadCashFlows(userId, account),
  ]);
  const name = new Map(accounts.map((a) => [a.id, a.name]));
  const csv = toCsv(
    sortTrades(trades).map((t) => ({ ...t, account: name.get(t.accountId) ?? "", memo: t.memo ?? "" })),
    dividends.reverse().map((d) => ({ ...d, account: name.get(d.accountId) ?? "", memo: d.memo ?? "" })),
    cash.reverse().map((c) => ({ ...c, account: name.get(c.accountId) ?? "", memo: c.memo ?? "" })),
  );
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="donjo-trades-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
