import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const isPooled = (url?: string) => !!url && /^prisma(\+postgres)?:\/\//.test(url);

/**
 * 앱 쿼리용 접속 주소를 고른다. (마이그레이션은 schema의 DATABASE_URL을 그대로 쓴다)
 * 1) Prisma Accelerate(커넥션 풀링) 주소가 있으면 그것을 쓴다. Vercel의 Prisma Postgres 연동은 보통
 *    PRISMA_DATABASE_URL에 넣어 준다.
 * 2) 직접 연결뿐이면, 서버리스(Vercel)에서는 인스턴스마다 커넥션을 여러 개 열어 DB 동시 접속 한도를
 *    넘기 쉬우므로 인스턴스당 1개로 제한한다.
 */
function resolveDatasource(): { url?: string; mode: string } {
  const candidates = [process.env.PRISMA_DATABASE_URL, process.env.DATABASE_URL];
  const pooled = candidates.find(isPooled);
  if (pooled) return { url: pooled, mode: "accelerate" };

  const direct = process.env.DATABASE_URL || process.env.PRISMA_DATABASE_URL;
  if (!direct || !process.env.VERCEL) return { url: direct || undefined, mode: "direct" };
  try {
    const u = new URL(direct);
    if (!u.searchParams.has("connection_limit")) u.searchParams.set("connection_limit", "1");
    return { url: u.toString(), mode: `direct (connection_limit=${u.searchParams.get("connection_limit")})` };
  } catch {
    return { url: direct, mode: "direct" };
  }
}

function createClient() {
  const { url, mode } = resolveDatasource();
  // 어떤 방식으로 접속하는지 서버 로그에 남긴다 (주소·비밀번호는 남기지 않음)
  console.info(`[db] ${mode}`);
  return new PrismaClient({ datasourceUrl: url });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
