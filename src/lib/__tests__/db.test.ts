import { describe, expect, it } from "vitest";
import { resolveDatasource } from "../db";

const direct = "postgres://u:p@db.prisma.io:5432/postgres?sslmode=require";
const pooled = "postgres://u:p@pooled.db.prisma.io:5432/postgres?sslmode=require";
const accelerate = "prisma+postgres://accelerate.prisma-data.net/?api_key=k";

describe("resolveDatasource", () => {
  it("ACCELERATE_URL의 풀러 주소(pooled.*)를 pgbouncer 모드로 쓴다", () => {
    const r = resolveDatasource({ VERCEL: "1", DATABASE_URL: direct, PRISMA_DATABASE_URL: direct, ACCELERATE_URL: pooled });
    expect(r.mode).toBe("pooled (pgbouncer=true)");
    const u = new URL(r.url!);
    expect(u.hostname).toBe("pooled.db.prisma.io");
    expect(u.searchParams.get("pgbouncer")).toBe("true");
    expect(u.searchParams.get("sslmode")).toBe("require");
  });

  it("Accelerate 주소가 있으면 가장 먼저 쓴다", () => {
    const r = resolveDatasource({ VERCEL: "1", DATABASE_URL: direct, ACCELERATE_URL: pooled, PRISMA_DATABASE_URL: accelerate });
    expect(r).toEqual({ url: accelerate, mode: "accelerate" });
  });

  it("다른 변수에 있는 풀러 주소도 찾는다", () => {
    expect(resolveDatasource({ VERCEL: "1", DATABASE_URL: direct, POSTGRES_URL: pooled }).mode).toBe("pooled (pgbouncer=true)");
  });

  it("직접 연결뿐이면 Vercel에서는 인스턴스당 커넥션 1개로 제한한다", () => {
    const r = resolveDatasource({ VERCEL: "1", DATABASE_URL: direct, PRISMA_DATABASE_URL: direct, POSTGRES_URL: direct });
    expect(r.mode).toBe("direct (connection_limit=1)");
    expect(new URL(r.url!).searchParams.get("connection_limit")).toBe("1");
  });

  it("로컬 개발에서는 DATABASE_URL을 그대로 쓴다", () => {
    const local = "postgresql://donjo:donjo@localhost:5432/donjo";
    expect(resolveDatasource({ DATABASE_URL: local })).toEqual({ url: local, mode: "direct" });
  });

  it("이미 있는 옵션은 덮어쓰지 않는다", () => {
    const r = resolveDatasource({ ACCELERATE_URL: `${pooled}&pgbouncer=false` });
    expect(new URL(r.url!).searchParams.getAll("pgbouncer")).toEqual(["false"]);
  });
});
