-- CreateEnum
CREATE TYPE "Market" AS ENUM ('KOSPI', 'KOSDAQ', 'US');

-- CreateEnum
CREATE TYPE "TradeType" AS ENUM ('BUY', 'SELL');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "broker" TEXT,
    "memo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "market" "Market" NOT NULL,
    "type" "TradeType" NOT NULL,
    "quantity" DECIMAL(20,6) NOT NULL,
    "price" DECIMAL(20,4) NOT NULL,
    "fee" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "tax" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "fxRate" DECIMAL(20,4) NOT NULL DEFAULT 1,
    "tradeDate" DATE NOT NULL,
    "memo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceBar" (
    "symbol" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "close" DECIMAL(20,4) NOT NULL,

    CONSTRAINT "PriceBar_pkey" PRIMARY KEY ("symbol","date")
);

-- CreateTable
CREATE TABLE "SymbolCache" (
    "symbol" TEXT NOT NULL,
    "price" DECIMAL(20,4),
    "previousClose" DECIMAL(20,4),
    "currency" TEXT,
    "quoteFetchedAt" TIMESTAMP(3),
    "barsFetchedAt" TIMESTAMP(3),

    CONSTRAINT "SymbolCache_pkey" PRIMARY KEY ("symbol")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE INDEX "Transaction_accountId_tradeDate_idx" ON "Transaction"("accountId", "tradeDate");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
