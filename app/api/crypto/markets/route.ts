import { NextResponse } from "next/server";
import { getTopCoinMarkets } from "@/lib/sources/coingecko";

export async function GET() {
  try {
    const data = await getTopCoinMarkets();
    return NextResponse.json({ available: true, updatedAt: new Date().toISOString(), data });
  } catch (err) {
    return NextResponse.json({
      available: false,
      updatedAt: new Date().toISOString(),
      data: [],
      error: err instanceof Error ? err.message : "Falha ao buscar dados da CoinGecko",
    });
  }
}
