import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// 우선순위대로 살펴볼 접속 주소 환경변수
const URL_ENVS = ["ACCELERATE_URL", "PRISMA_DATABASE_URL", "DATABASE_URL", "POSTGRES_URL"] as const;

/** Prisma Accelerate (HTTP 커넥션 풀링): prisma:// 또는 prisma+postgres:// */
const isAccelerate = (url: string) => /^prisma(\+postgres)?:\/\//.test(url);

/** TCP 커넥션 풀러 (예: Prisma Postgres의 pooled.db.prisma.io) */
function isPooledHost(url: string) {
  try {
    return new URL(url).hostname.startsWith("pooled.");
  } catch {
    return false;
  }
}

function withParams(url: string, params: Record<string, string>) {
  const u = new URL(url);
  for (const [k, v] of Object.entries(params)) if (!u.searchParams.has(k)) u.searchParams.set(k, v);
  return u.toString();
}

/**
 * 앱 쿼리용 접속 주소를 고른다. (마이그레이션은 schema의 DATABASE_URL = 직접 연결을 그대로 쓴다)
 * 서버리스(Vercel)에서 직접 연결을 쓰면 인스턴스마다 커넥션을 열어 DB 동시 접속 한도를 넘기 쉬우므로
 * 1) Accelerate 주소 → 2) 풀러 주소(pooled.*) → 3) 직접 연결(인스턴스당 1개로 제한) 순으로 쓴다.
 */
export function resolveDatasource(env: Record<string, string | undefined> = process.env): { url?: string; mode: string } {
  const urls = URL_ENVS.map((k) => env[k]).filter((u): u is string => !!u);

  const accelerate = urls.find(isAccelerate);
  if (accelerate) return { url: accelerate, mode: "accelerate" };

  const pooled = urls.find(isPooledHost);
  // 트랜잭션 모드 풀러는 prepared statement를 공유하지 못하므로 Prisma의 pgbouncer 모드를 켠다
  // 풀러 앞에서는 인스턴스당 연결을 넉넉히 둬도 된다 (기본 5개면 한 화면의 동시 쿼리가 줄 서서 느려지고 대기 시간 초과가 난다)
  if (pooled)
    return {
      url: withParams(pooled, { pgbouncer: "true", connection_limit: "15", pool_timeout: "20" }),
      mode: "pooled (pgbouncer=true, connection_limit=15)",
    };

  const direct = env.DATABASE_URL || urls[0];
  if (!direct || !env.VERCEL) return { url: direct, mode: "direct" };
  try {
    return { url: withParams(direct, { connection_limit: "1" }), mode: "direct (connection_limit=1)" };
  } catch {
    return { url: direct, mode: "direct" };
  }
}

function createClient() {
  const { url, mode } = resolveDatasource();
  // 어떤 방식으로 접속하는지 서버 로그에 남긴다 (주소·비밀번호는 남기지 않음)
  console.info(`[db] ${mode}`);
  const client = new PrismaClient({ datasourceUrl: url });
  // 느린 쿼리만 로그에 남긴다 (연결 대기 시간 포함). 어디서 느린지 찾기 위해
  return client.$extends({
    query: {
      async $allOperations({ model, operation, args, query }) {
        const t = Date.now();
        try {
          return await query(args);
        } finally {
          const ms = Date.now() - t;
          if (ms >= SLOW_QUERY_MS) console.warn(`[db] 느린 쿼리 ${ms}ms ${model ?? ""}.${operation}`);
        }
      },
    },
  }) as unknown as PrismaClient;
}

const SLOW_QUERY_MS = 300;

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
