import { hasDatabase } from "@/lib/db/client";
import { getCloses } from "@/lib/db/priceSeriesRepo";
import { computeVolatility, type VolatilityResult } from "@/lib/volatility";
import { B3_WATCHLIST } from "@/lib/watchlist";

// Limitado à watchlist (4 papéis livres da brapi.dev sem token — PETR4/VALE3/
// MGLU3/ITUB4). Ranking de mercado inteiro exige BRAPI_TOKEN pago/gratuito com
// cadastro; ver README para instruções de como habilitar.
export async function getB3VolatilityRanking(): Promise<VolatilityResult[]> {
  if (!hasDatabase()) {
    throw new Error("DATABASE_URL não configurada — volatilidade precisa do histórico salvo no banco.");
  }

  const results: VolatilityResult[] = [];
  for (const entry of B3_WATCHLIST) {
    const closes = await getCloses(entry.symbol, "b3", 30);
    if (closes.length < 2) continue;
    const vol = computeVolatility(entry.symbol, entry.label, closes.map((c) => c.closePrice));
    if (vol) results.push(vol);
  }

  results.sort((a, b) => b.vol1m - a.vol1m);
  return results;
}
