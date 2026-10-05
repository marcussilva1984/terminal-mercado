import { NextResponse } from "next/server";
import { getYahooQuotes } from "@/lib/sources/yahoo";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const raw = searchParams.get("symbols") ?? "";
  const symbols = raw.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 30);
  if (!symbols.length) return NextResponse.json({});
  try {
    const quotes = await getYahooQuotes(symbols, 30);
    const out: Record<string, { price: number; changePct: number }> = {};
    for (const [sym, q] of Object.entries(quotes)) {
      if (q) out[sym] = { price: q.price, changePct: q.changePct };
    }
    return NextResponse.json(out);
  } catch {
    return NextResponse.json({});
  }
}
