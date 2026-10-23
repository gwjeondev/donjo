import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getQuotes } from "@/lib/market/service";

/** 매매 입력용 현재가 조회. ?symbol=005930&market=KOSPI */
export async function GET(req: Request) {
  if (!(await auth())?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const params = new URL(req.url).searchParams;
  const code = (params.get("symbol") ?? "").trim().toUpperCase().replace(/\.(KS|KQ)$/, "");
  const market = params.get("market");
  if (!/^[A-Z0-9.\-]{1,20}$/.test(code)) return NextResponse.json({ error: "invalid symbol" }, { status: 400 });
  const symbol = market === "KOSPI" ? `${code}.KS` : market === "KOSDAQ" ? `${code}.KQ` : code;
  const quote = (await getQuotes([symbol])).get(symbol);
  return quote ? NextResponse.json({ price: quote.price }) : NextResponse.json({ error: "not found" }, { status: 404 });
}
