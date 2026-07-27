import { NextResponse } from "next/server";
import { getTickerDetail } from "@/lib/sources/yahooTickerDetail";

// Edge Runtime: mesmo motivo do /api/derivatives e /api/analyst-targets — o
// crumb do Yahoo falha a partir da região serverless padrão da Vercel.
export const runtime = "edge";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol");
  if (!symbol) {
    return NextResponse.json({ available: false, data: null, error: "parâmetro symbol obrigatório" });
  }

  const data = await getTickerDetail(symbol);
  if (!data) {
    return NextResponse.json({ available: false, data: null, error: `Sem dados para ${symbol}` });
  }
  return NextResponse.json({ available: true, data });
}
