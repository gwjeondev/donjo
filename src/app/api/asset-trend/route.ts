// 자산 추이 데이터: 대시보드의 '자산 추이' 팝업을 열 때만 불려서, 평소 대시보드는 일별 시세 계산을 하지 않는다.
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { loadPerformance } from "@/lib/data";
import { cumulative } from "@/lib/performance";

export const dynamic = "force-dynamic";

export async function GET() {
  const userId = (await auth())?.user?.id;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const perf = await loadPerformance(userId);
  return NextResponse.json({
    // 총자산 = 주식 평가금액 + 현금 (원화 환산)
    points: cumulative(perf.daily).map((p) => ({ ...p, value: Math.round(p.value + (perf.cashDaily[p.date] ?? 0)) })),
    withCash: Object.keys(perf.cashDaily).length > 0,
    failed: perf.failed,
  });
}
