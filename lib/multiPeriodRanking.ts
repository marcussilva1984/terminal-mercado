import { unstable_cache } from "next/cache";
import { hasDatabase } from "@/lib/db/client";
import { getWatchlist } from "@/lib/db/watchlistRepo";
import { getClosesForClass } from "@/lib/db/priceSeriesRepo";

export interface MultiPeriodChange {
  symbol: string;
  label: string;
  price: number;
  changePct1d: number | null;
  changePct7d: number | null;
  changePct30d: number | null;
}

// Variação em 1/7/30 dias pra tudo na watchlist — histórico coletado 1x por
// dia (mesma tabela do z-score/volatilidade/SMA200), sem fonte nova. É
// escopo da watchlist, não do mercado inteiro (isso exigiria histórico de
// TODOS os ativos negociados, que não coletamos) — diferente das tabelas de
// "Maiores Altas/Baixas" já existentes, que são mercado inteiro mas só do
// dia. As duas se complementam: uma mostra amplitude (mercado, 1 dia), essa
// mostra profundidade (sua watchlist, múltiplos prazos).
async function computeMultiPeriodRanking(assetClass: string): Promise<MultiPeriodChange[]> {
  if (!hasDatabase()) return [];

  const [watchlist, closesBySymbol] = await Promise.all([getWatchlist(assetClass), getClosesForClass(assetClass, 31)]);

  const results: MultiPeriodChange[] = [];
  for (const w of watchlist) {
    const closes = closesBySymbol.get(w.symbol);
    if (!closes || closes.length < 2) continue;

    const last = closes[closes.length - 1].closePrice;
    const prev1d = closes[closes.length - 2]?.closePrice ?? null;
    const prev7d = closes.length > 7 ? closes[closes.length - 8].closePrice : null;
    const prev30d = closes.length >= 31 ? closes[0].closePrice : null;

    const pct = (base: number | null) => (base !== null && base !== 0 ? ((last - base) / base) * 100 : null);

    results.push({
      symbol: w.symbol,
      label: w.label,
      price: last,
      changePct1d: pct(prev1d),
      changePct7d: pct(prev7d),
      changePct30d: pct(prev30d),
    });
  }

  return results;
}

export const getMultiPeriodRanking = unstable_cache(computeMultiPeriodRanking, ["multi-period-ranking"], {
  revalidate: 15 * 60,
});
