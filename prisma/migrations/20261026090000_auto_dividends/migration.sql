-- CreateEnum
CREATE TYPE "AccountKind" AS ENUM ('GENERAL', 'ISA', 'PENSION');

-- AlterTable
ALTER TABLE "Account" ADD COLUMN     "kind" "AccountKind" NOT NULL DEFAULT 'GENERAL';

-- AlterTable
ALTER TABLE "Dividend" ADD COLUMN     "auto" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "exDate" DATE;

-- AlterTable
ALTER TABLE "SymbolCache" ADD COLUMN     "divFetchedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "DividendSkip" (
    "accountId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "exDate" DATE NOT NULL,

    CONSTRAINT "DividendSkip_pkey" PRIMARY KEY ("accountId","symbol","exDate")
);

-- CreateTable
CREATE TABLE "DividendEvent" (
    "symbol" TEXT NOT NULL,
    "exDate" DATE NOT NULL,
    "amount" DECIMAL(20,6) NOT NULL,

    CONSTRAINT "DividendEvent_pkey" PRIMARY KEY ("symbol","exDate")
);

-- CreateIndex
CREATE UNIQUE INDEX "Dividend_accountId_symbol_exDate_key" ON "Dividend"("accountId", "symbol", "exDate");

-- AddForeignKey
ALTER TABLE "DividendSkip" ADD CONSTRAINT "DividendSkip_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

