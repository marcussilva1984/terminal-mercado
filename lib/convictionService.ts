import { getZScoreHighlights } from "@/lib/zscoreService";
import { getRecentAlerts } from "@/lib/db/alertRepo";
import { getBaseUrl } from "@/lib/baseUrl";
import { B3_WATCHLIST, STOCKS_WATCHLIST } from "@/lib/watchlist";
import type { AnalystTarget } from "@/lib/sources/yahooAnalyst";

export interface ConvictionEntry {
  symbol: string;
  label: string;
  assetClass: string;
  score: number;
  reasons: string[];
}

// Combina sinais que já calculamos em outros painéis (z-score, preço-alvo
// batido, notícia de alta/média prioridade recente) num único score — não
// inventa análise nova, só soma o que já é real em cada painel separado.
export async function getConvictionRanking(): Promise<ConvictionEntry[]> {
  const [zScoreResult, alertsResult, priceTargetResult] = await Promise.allSettled([
    getZScoreHighlights(),
    getRecentAlerts(24, 100),
    (async () => {
      const symbols = [...B3_WATCHLIST.map((w) => `${w.symbol}.SA`), ...STOCKS_WATCHLIST.map((w) => w.symbol)].join(",");
      const res = await fetch(`${getBaseUrl()}/api/analyst-targets?symbols=${encodeURIComponent(symbols)}`, {
        next: { revalidate: 120 },
      });
      const json = await res.json();
      if (!json.available) return [];
      return (json.data as AnalystTarget[]).filter(
        (t) => t.currentPrice !== null && t.targetMeanPrice !== null && t.currentPrice >= t.targetMeanPrice
      );
    })(),
  ]);

  const zScores = zScoreResult.status === "fulfilled" ? zScoreResult.value : [];
  const recentAlerts = alertsResult.status === "fulfilled" ? alertsResult.value : [];
  const priceTargetHits = priceTargetResult.status === "fulfilled" ? priceTargetResult.value : [];

  const recentNews = recentAlerts.filter((a) => a.kind === "noticia");

  const entries: ConvictionEntry[] = [];
  for (const z of zScores) {
    const reasons: string[] = [];
    let score = Math.abs(z.zScore);
    if (Math.abs(z.zScore) >= 2) reasons.push(`z-score |${z.zScore.toFixed(1)}|`);

    const targetHit = priceTargetHits.find((t) => t.symbol.replace(".SA", "") === z.symbol);
    if (targetHit) {
      score += 2;
      reasons.push("preço-alvo batido");
    }

    const newsHit = recentNews.find((n) => n.label.toUpperCase().includes(z.symbol.toUpperCase()));
    if (newsHit) {
      score += 1;
      reasons.push("notícia recente");
    }

    if (reasons.length > 0) {
      entries.push({ symbol: z.symbol, label: z.label, assetClass: z.assetClass, score, reasons });
    }
  }

  entries.sort((a, b) => b.score - a.score);
  return entries;
}
