import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// Vercel의 Prisma Postgres 연동은 PRISMA_DATABASE_URL(Accelerate, 커넥션 풀링)을 함께 넣어 준다.
// 서버리스에서 직접 연결(DATABASE_URL)을 쓰면 인스턴스마다 커넥션을 열어 동시 접속 한도를 넘기므로,
// 앱 쿼리는 풀링 주소를 우선 사용한다. 마이그레이션은 schema의 DATABASE_URL(직접 연결)을 그대로 쓴다.
export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ datasourceUrl: process.env.PRISMA_DATABASE_URL || undefined });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
