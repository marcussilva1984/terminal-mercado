import { hasDatabase } from "@/lib/db/client";
import { getCloses } from "@/lib/db/priceSeriesRepo";
import { getWatchlist, seedWatchlistIfEmpty } from "@/lib/db/watchlistRepo";
import { computeZScore } from "@/lib/zscore";
import { B3_WATCHLIST, CRIPTO_WATCHLIST, FII_WATCHLIST, STOCKS_WATCHLIST, FOREX_WATCHLIST } from "@/lib/watchlist";
import type { AssetClass, ZScoreHighlight } from "@/lib/types";

const ALL_CLASSES: AssetClass[] = ["b3", "cripto", "fii", "stocks", "forex"];

const DEFAULT_WATCHLIST_BY_CLASS: Partial<Record<AssetClass, { symbol: string; label: string }[]>> = {
  b3: B3_WATCHLIST,
  cripto: CRIPTO_WATCHLIST,
  fii: FII_WATCHLIST,
  stocks: STOCKS_WATCHLIST,
  forex: FOREX_WATCHLIST,
};

// Forex usa janela de 200 pregões (convenção de mercado, tipo SMA200) em vez
// dos ~30 das outras classes — uso de longo prazo, não daytrade.
const ZSCORE_WINDOW_BY_CLASS: Partial<Record<AssetClass, number>> = {
  forex: 200,
};
const DEFAULT_ZSCORE_WINDOW = 30;

export async function getZScoreHighlights(assetClass?: AssetClass): Promise<ZScoreHighlight[]> {
  if (!hasDatabase()) {
    throw new Error("DATABASE_URL não configurada — z-score precisa do histórico salvo no banco.");
  }

  await seedWatchlistIfEmpty(
    ALL_CLASSES.flatMap((cls) => (DEFAULT_WATCHLIST_BY_CLASS[cls] ?? []).map((w) => ({ ...w, assetClass: cls })))
  );

  const classesToLoad = assetClass ? [assetClass] : ALL_CLASSES;
  const entries = (
    await Promise.all(
      classesToLoad.map(async (cls) => {
        const items = await getWatchlist(cls);
        return items.map((w) => ({ symbol: w.symbol, label: w.label, assetClass: cls }));
      })
    )
  ).flat();

  const results: ZScoreHighlight[] = [];

  for (const entry of entries) {
    const window = ZSCORE_WINDOW_BY_CLASS[entry.assetClass] ?? DEFAULT_ZSCORE_WINDOW;
    const closes = await getCloses(entry.symbol, entry.assetClass, window + 1);
    if (closes.length < 2) continue;

    const z = computeZScore(closes.map((c) => c.closePrice), window);
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
