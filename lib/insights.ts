import type { RankingItem, FlowSegment, ZScoreHighlight } from "@/lib/types";
import { formatPct } from "@/lib/format";

// Insights gerados a partir dos dados que já temos (rankings + fluxo agregado +
// z-score). NÃO atribui fluxo de investidor a um ticker específico — isso não
// existe de graça (só no B3 DataWise+, pago).
export function buildB3Insights(
  gainers: RankingItem[],
  losers: RankingItem[],
  byVolume: RankingItem[],
  flowSegments: FlowSegment[],
  zScoreHighlights: ZScoreHighlight[]
): string[] {
  const insights: string[] = [];

  const topGainer = gainers[0];
  const topLoser = losers[0];
  if (topGainer) {
    insights.push(`${topGainer.symbol} lidera as altas do dia (${formatPct(topGainer.changePct)}).`);
  }
  if (topLoser) {
    insights.push(`${topLoser.symbol} lidera as baixas do dia (${formatPct(topLoser.changePct)}).`);
  }

  // Convicção alta: ativo aparece tanto entre os maiores movimentos quanto entre os maiores volumes.
  const volumeSymbols = new Set(byVolume.slice(0, 10).map((v) => v.symbol));
  const highConviction = [...gainers.slice(0, 10), ...losers.slice(0, 10)].find((m) => volumeSymbols.has(m.symbol));
  if (highConviction) {
    insights.push(
      `${highConviction.symbol} está entre os maiores volumes E maiores movimentos do dia — sinal de interesse forte do mercado, não só ruído.`
    );
  }

  const strongFlow = flowSegments.find((s) => s.signal !== "amarelo");
  if (strongFlow) {
    insights.push(strongFlow.reading);
  }

  const extremeZ = zScoreHighlights.find((z) => Math.abs(z.zScore) >= 2);
  if (extremeZ) {
    insights.push(
      `${extremeZ.symbol} com z-score ${extremeZ.zScore >= 0 ? "+" : ""}${extremeZ.zScore.toFixed(1)} — movimento fora do padrão histórico do ativo.`
    );
  }

  return insights;
}
