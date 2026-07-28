import { NextResponse } from "next/server";
import { fetchCandles, type ChartInterval } from "@/lib/sources/yahooTickerDetail";

// Rota separada da /api/ticker-detail — só o gráfico, pra trocar de período
// (diário/semanal/mensal) sem re-buscar indicadores/analistas de novo.
export const runtime = "edge";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol");
  const interval = (searchParams.get("interval") as ChartInterval) || "1d";
  if (!symbol) {
    return NextResponse.json({ available: false, data: [], error: "parâmetro symbol obrigatório" });
  }

  try {
    const data = await fetchCandles(symbol, interval);
    return NextResponse.json({ available: true, data });
  } catch (err) {
    return NextResponse.json({
      available: false,
      data: [],
      error: err instanceof Error ? err.message : "Falha ao carregar gráfico",
    });
  }
}
