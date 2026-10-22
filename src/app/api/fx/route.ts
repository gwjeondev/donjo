import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getUsdKrwOn } from "@/lib/market/service";

export async function GET(req: Request) {
  if (!(await auth())?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const date = new URL(req.url).searchParams.get("date") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: "invalid date" }, { status: 400 });
  return NextResponse.json({ rate: await getUsdKrwOn(date) });
}
