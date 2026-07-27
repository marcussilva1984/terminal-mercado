import { hasDatabase } from "@/lib/db/client";
import { getCloses } from "@/lib/db/priceSeriesRepo";
import { getWatchlist, seedWatchlistIfEmpty } from "@/lib/db/watchlistRepo";
import { computeZScore } from "@/lib/zscore";
import { B3_WATCHLIST, CRIPTO_WATCHLIST } from "@/lib/watchlist";
import type { AssetClass, ZScoreHighlight } from "@/lib/types";

export async function getZScoreHighlights(
  assetClass?: Extract<AssetClass, "b3" | "cripto">
): Promise<ZScoreHighlight[]> {
  if (!hasDatabase()) {
    throw new Error("DATABASE_URL não configurada — z-score precisa do histórico salvo no banco.");
  }

  await seedWatchlistIfEmpty([
    ...B3_WATCHLIST.map((w) => ({ ...w, assetClass: "b3" })),
    ...CRIPTO_WATCHLIST.map((w) => ({ ...w, assetClass: "cripto" })),
  ]);

  const b3Items = assetClass === "cripto" ? [] : await getWatchlist("b3");
  const criptoItems = assetClass === "b3" ? [] : await getWatchlist("cripto");

  const entries = [
    ...b3Items.map((w) => ({ symbol: w.symbol, label: w.label, assetClass: "b3" as const })),
    ...criptoItems.map((w) => ({ symbol: w.symbol, label: w.label, assetClass: "cripto" as const })),
  ];

  const results: ZScoreHighlight[] = [];

  for (const entry of entries) {
    const closes = await getCloses(entry.symbol, entry.assetClass, 60);
    if (closes.length < 2) continue;

    const z = computeZScore(closes.map((c) => c.closePrice));
    if (!z) continue;

    results.push({
      symbol: entry.symbol,
      label: entry.label,
      changePct: z.changePct,
      zScore: z.zScore,
      assetClass: entry.assetClass,
    });
  }

  results.sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore));
  return results;
}
