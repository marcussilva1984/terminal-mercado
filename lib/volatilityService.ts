import { hasDatabase } from "@/lib/db/client";
import { getCloses } from "@/lib/db/priceSeriesRepo";
import { getWatchlist, seedWatchlistIfEmpty } from "@/lib/db/watchlistRepo";
import { computeVolatility, type VolatilityResult } from "@/lib/volatility";
import { B3_WATCHLIST, CRIPTO_WATCHLIST } from "@/lib/watchlist";

// Limitado aos papéis na watchlist (editável em /watchlist). Sem BRAPI_TOKEN,
// só PETR4/VALE3/MGLU3/ITUB4 têm histórico de preço coletável — adicionar
// outros papéis exige token gratuito da brapi.dev.
export async function getB3VolatilityRanking(): Promise<VolatilityResult[]> {
  if (!hasDatabase()) {
    throw new Error("DATABASE_URL não configurada — volatilidade precisa do histórico salvo no banco.");
  }

  await seedWatchlistIfEmpty([
    ...B3_WATCHLIST.map((w) => ({ ...w, assetClass: "b3" })),
    ...CRIPTO_WATCHLIST.map((w) => ({ ...w, assetClass: "cripto" })),
  ]);

  const watchlist = await getWatchlist("b3");
  const results: VolatilityResult[] = [];
  for (const entry of watchlist) {
    const closes = await getCloses(entry.symbol, "b3", 30);
    if (closes.length < 2) continue;
    const vol = computeVolatility(entry.symbol, entry.label, closes.map((c) => c.closePrice));
    if (vol) results.push(vol);
  }

  results.sort((a, b) => b.vol1m - a.vol1m);
  return results;
}
