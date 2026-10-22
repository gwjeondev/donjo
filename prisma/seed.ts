// 데모 데이터: demo@donjo.app / demo1234
import { PrismaClient, type Market, type TradeType } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const daysAgo = (n: number) => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - n);
  // 주말이면 금요일로
  while (d.getUTCDay() % 6 === 0) d.setUTCDate(d.getUTCDate() - 1);
  return d;
};

type T = [symbol: string, name: string, market: Market, type: TradeType, qty: number, price: number, daysAgo: number, fx?: number];

async function main() {
  const email = "demo@donjo.app";
  await prisma.user.deleteMany({ where: { email } });
  const user = await prisma.user.create({
    data: { email, name: "데모", passwordHash: await bcrypt.hash("demo1234", 10) },
  });
  const plans: { name: string; broker: string; trades: T[] }[] = [
    {
      name: "일반 계좌",
      broker: "키움증권",
      trades: [
        ["005930.KS", "삼성전자", "KOSPI", "BUY", 30, 71000, 400],
        ["000660.KS", "SK하이닉스", "KOSPI", "BUY", 5, 178000, 330],
        ["005930.KS", "삼성전자", "KOSPI", "BUY", 20, 64000, 200],
        ["247540.KQ", "에코프로비엠", "KOSDAQ", "BUY", 8, 210000, 150],
        ["000660.KS", "SK하이닉스", "KOSPI", "SELL", 2, 205000, 60],
      ],
    },
    {
      name: "해외주식",
      broker: "미래에셋증권",
      trades: [
        ["AAPL", "Apple Inc.", "US", "BUY", 10, 185.5, 380, 1310],
        ["NVDA", "NVIDIA Corporation", "US", "BUY", 15, 118.2, 240, 1365],
        ["QQQ", "Invesco QQQ Trust", "US", "BUY", 4, 480, 120, 1390],
        ["AAPL", "Apple Inc.", "US", "SELL", 3, 228, 30, 1385],
      ],
    },
  ];
  for (const plan of plans) {
    await prisma.account.create({
      data: {
        userId: user.id,
        name: plan.name,
        broker: plan.broker,
        transactions: {
          create: plan.trades.map(([symbol, name, market, type, quantity, price, ago, fx]) => ({
            symbol,
            name,
            market,
            type,
            quantity,
            price,
            fee: market === "US" ? 0 : Math.round(quantity * price * 0.00015),
            tax: type === "SELL" && market !== "US" ? Math.round(quantity * price * 0.0018) : 0,
            fxRate: fx ?? 1,
            tradeDate: daysAgo(ago),
          })),
        },
      },
    });
  }
  console.log(`seeded ${email} / demo1234`);
}

main().finally(() => prisma.$disconnect());
