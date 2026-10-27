// DB 접속 점검 (로그인한 사용자만): 함수 지역에서 DB까지 왕복 시간을 접속 주소별로 잰다.
// 주소 자체나 비밀번호는 내보내지 않고, 호스트 이름과 걸린 시간만 알려 준다.
import { PrismaClient } from "@prisma/client";
import { NextResponse } from "next/server";
import { URL_ENVS } from "@/lib/db";
import { requireUserId } from "@/lib/session";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function ping(url: string) {
  const client = new PrismaClient({ datasourceUrl: url });
  try {
    const t0 = Date.now();
    await client.$queryRaw`SELECT 1`;
    const connectMs = Date.now() - t0;
    const rtts: number[] = [];
    for (let i = 0; i < 5; i++) {
      const t = Date.now();
      await client.$queryRaw`SELECT 1`;
      rtts.push(Date.now() - t);
    }
    return { ok: true as const, connectMs, rtts, medianMs: [...rtts].sort((a, b) => a - b)[2] };
  } catch (e) {
    return { ok: false as const, error: (e as Error).message.split("\n").pop() };
  } finally {
    await client.$disconnect().catch(() => {});
  }
}

export async function GET() {
  await requireUserId();
  const seen = new Set<string>();
  const results = [];
  for (const name of URL_ENVS) {
    const raw = process.env[name];
    if (!raw || seen.has(raw)) continue;
    seen.add(raw);
    let url = raw;
    let host = "?";
    try {
      const u = new URL(raw);
      host = u.hostname;
      // 앱이 실제로 쓰는 방식과 같게: 풀러는 pgbouncer 모드, 직접 연결은 연결 1개
      if (host.startsWith("pooled.")) u.searchParams.set("pgbouncer", "true");
      else if (!/^prisma/.test(u.protocol)) u.searchParams.set("connection_limit", "1");
      url = u.toString();
    } catch {}
    results.push({ env: name, host, ...(await ping(url)) });
  }
  return NextResponse.json({
    functionRegion: process.env.VERCEL_REGION ?? "local",
    note: "medianMs가 보통 20 이하면 같은 지역, 100 이상이면 멀거나 중계가 느린 거예요",
    results,
  });
}
