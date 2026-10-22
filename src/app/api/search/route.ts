import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { provider } from "@/lib/market";

export async function GET(req: Request) {
  if (!(await auth())?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 1) return NextResponse.json({ results: [] });
  try {
    return NextResponse.json({ results: await provider.search(q) });
  } catch (e) {
    return NextResponse.json({ results: [], error: (e as Error).message }, { status: 502 });
  }
}
