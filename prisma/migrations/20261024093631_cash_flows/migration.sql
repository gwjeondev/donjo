-- CreateEnum
CREATE TYPE "CashType" AS ENUM ('DEPOSIT', 'WITHDRAW', 'EXCHANGE');

-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('KRW', 'USD');

-- CreateTable
CREATE TABLE "CashFlow" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "type" "CashType" NOT NULL,
    "currency" "Currency" NOT NULL,
    "amount" DECIMAL(20,4) NOT NULL,
    "fxRate" DECIMAL(20,4) NOT NULL DEFAULT 1,
    "date" DATE NOT NULL,
    "memo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashFlow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CashFlow_accountId_date_idx" ON "CashFlow"("accountId", "date");

-- AddForeignKey
ALTER TABLE "CashFlow" ADD CONSTRAINT "CashFlow_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
