import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { provider } from "@/lib/market";
import { detectKoreanExchange } from "@/lib/market/service";
import { KR_CODE } from "@/lib/market/naver";
import type { Market } from "@/lib/portfolio";

/**
 * 종목코드/티커로 시장과 이름을 찾는다 (직접 입력할 때 시장 자동 판별).
 * 국내 코드는 네이버 → 실패 시 Yahoo 시세가 있는 쪽(.KS/.KQ)으로 판별. 티커는 미국.
 */
export async function GET(req: Request) {
  if (!(await auth())?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const code = (new URL(req.url).searchParams.get("code") ?? "").trim().toUpperCase().replace(/\.(KS|KQ)$/, "");
  if (!/^[A-Z0-9.\-]{1,20}$/.test(code)) return NextResponse.json({ error: "invalid code" }, { status: 400 });

  if (!KR_CODE.test(code)) {
    const hit = await provider
      .search(code)
      .then((r) => r.find((x) => x.market === "US" && x.symbol === code))
      .catch(() => undefined);
    return NextResponse.json({ market: "US" satisfies Market, name: hit?.name ?? null });
  }

  return NextResponse.json(await detectKoreanExchange(code));
}
