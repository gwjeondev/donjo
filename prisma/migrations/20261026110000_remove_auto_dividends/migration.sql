-- 자동 배당 기능 제거: 앱이 자동으로 만든 배당 기록을 지운다 (사용자가 고친 기록은 직접 넣은 기록으로 남긴다)
DELETE FROM "Dividend" WHERE "auto" = true;

-- DropForeignKey
ALTER TABLE "DividendSkip" DROP CONSTRAINT "DividendSkip_accountId_fkey";

-- DropIndex
DROP INDEX "Dividend_accountId_symbol_exDate_key";

-- AlterTable
ALTER TABLE "Account" DROP COLUMN "kind";

-- AlterTable
ALTER TABLE "Dividend" DROP COLUMN "auto",
DROP COLUMN "exDate";

-- AlterTable
ALTER TABLE "SymbolCache" DROP COLUMN "divFetchedAt";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "dividendsSyncedAt";

-- DropTable
DROP TABLE "DividendEvent";

-- DropTable
DROP TABLE "DividendSkip";

-- DropEnum
DROP TYPE "AccountKind";

