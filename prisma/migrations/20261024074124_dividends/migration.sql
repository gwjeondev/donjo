-- CreateTable
CREATE TABLE "Dividend" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "market" "Market" NOT NULL,
    "amount" DECIMAL(20,4) NOT NULL,
    "tax" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "fxRate" DECIMAL(20,4) NOT NULL DEFAULT 1,
    "payDate" DATE NOT NULL,
    "memo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Dividend_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Dividend_accountId_payDate_idx" ON "Dividend"("accountId", "payDate");

-- AddForeignKey
ALTER TABLE "Dividend" ADD CONSTRAINT "Dividend_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
