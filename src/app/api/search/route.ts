import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { koreanSource, provider } from "@/lib/market";
import type { SymbolSearchResult } from "@/lib/market";

/**
 * 종목 검색. 국내 종목은 네이버 증권(한글 이름·한글 검색), 미국 종목은 Yahoo에서 찾는다.
 * 한쪽이 실패해도 다른 쪽 결과는 보여 준다.
 */
export async function GET(req: Request) {
  if (!(await auth())?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 1) return NextResponse.json({ results: [] });

  const [kr, global] = await Promise.allSettled([koreanSource.search(q), provider.search(q)]);
  const korean = kr.status === "fulfilled" ? kr.value : [];
  const fromYahoo = global.status === "fulfilled" ? global.value : [];
  // 네이버에서 찾은 국내 종목은 Yahoo의 영문 결과로 중복 표시하지 않는다
  const seen = new Set(korean.map((r) => r.symbol.slice(0, 6)));
  const results: SymbolSearchResult[] = [
    ...korean,
    ...fromYahoo.filter((r) => r.market === "US" || (korean.length === 0 ? true : !seen.has(r.symbol.slice(0, 6)))),
  ].slice(0, 20);

  if (kr.status === "rejected") console.warn("[search] 네이버 검색 실패:", (kr.reason as Error)?.message);
  if (results.length === 0 && kr.status === "rejected" && global.status === "rejected") {
    return NextResponse.json({ results: [], error: "검색 서비스에 연결하지 못했어요" }, { status: 502 });
  }
  return NextResponse.json({ results });
}
