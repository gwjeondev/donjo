import { auth } from "@/auth";
import { toCsv } from "@/lib/csv";
import { loadTrades } from "@/lib/data";
import { prisma } from "@/lib/db";
import { sortTrades } from "@/lib/portfolio";

/** 매매 기록 CSV 다운로드 (?account=계좌ID 로 한 계좌만) */
export async function GET(req: Request) {
  const userId = (await auth())?.user?.id;
  if (!userId) return new Response("unauthorized", { status: 401 });
  const account = new URL(req.url).searchParams.get("account") ?? undefined;
  const [accounts, trades] = await Promise.all([
    prisma.account.findMany({ where: { userId }, select: { id: true, name: true } }),
    loadTrades(userId, account),
  ]);
  const name = new Map(accounts.map((a) => [a.id, a.name]));
  const csv = toCsv(
    sortTrades(trades).map((t) => ({ ...t, account: name.get(t.accountId) ?? "", memo: t.memo ?? "" })),
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
