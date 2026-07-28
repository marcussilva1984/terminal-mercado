import type { RankingItem, FlowSegment, ZScoreHighlight } from "@/lib/types";
import { formatPct } from "@/lib/format";

// Garante um mínimo de insights na aba (pedido explícito do usuário: pelo
// menos 10) completando com movimentos genéricos do pool de altas/baixas que
// ainda não apareceram, evitando repetir o mesmo símbolo duas vezes.
export function fillMinimumInsights(insights: string[], pool: RankingItem[], min = 10): string[] {
  if (insights.length >= min) return insights;
  const alreadyMentioned = new Set(insights.map((i) => i.match(/^([A-Z0-9^.]+)/)?.[1]).filter(Boolean));
  const filled = [...insights];
  for (const item of pool) {
    if (filled.length >= min) break;
    if (alreadyMentioned.has(item.symbol)) continue;
    filled.push(`${item.symbol} variação de ${formatPct(item.changePct)} hoje.`);
    alreadyMentioned.add(item.symbol);
  }
  return filled;
}

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

  gainers.slice(0, 3).forEach((g, i) => {
    insights.push(
      i === 0
        ? `${g.symbol} lidera as altas do dia (${formatPct(g.changePct)}).`
        : `${g.symbol} também entre as maiores altas (${formatPct(g.changePct)}).`
    );
  });
  losers.slice(0, 3).forEach((l, i) => {
    insights.push(
      i === 0
        ? `${l.symbol} lidera as baixas do dia (${formatPct(l.changePct)}).`
        : `${l.symbol} também entre as maiores baixas (${formatPct(l.changePct)}).`
    );
  });

  // Convicção alta: ativo aparece tanto entre os maiores movimentos quanto entre os maiores volumes.
  const volumeSymbols = new Set(byVolume.slice(0, 10).map((v) => v.symbol));
  const highConvictionMoves = [...gainers.slice(0, 10), ...losers.slice(0, 10)].filter((m) => volumeSymbols.has(m.symbol));
  highConvictionMoves.slice(0, 3).forEach((m) => {
    insights.push(
      `${m.symbol} está entre os maiores volumes E maiores movimentos do dia (${formatPct(m.changePct)}) — sinal de interesse forte, não só ruído.`
    );
  });

  flowSegments
    .filter((s) => s.signal !== "amarelo")
    .forEach((s) => insights.push(s.reading));

  zScoreHighlights
    .filter((z) => Math.abs(z.zScore) >= 2)
    .slice(0, 3)
    .forEach((z) => {
      insights.push(
        `${z.symbol} com z-score ${z.zScore >= 0 ? "+" : ""}${z.zScore.toFixed(1)} — movimento fora do padrão histórico do ativo.`
      );
    });

  if (byVolume[0]) {
    insights.push(`${byVolume[0].symbol} lidera o volume negociado do dia.`);
  }

  return insights;
}

// Versão genérica (sem fluxo B3) — altas/baixas/volume/z-score, usada em
// Cripto e FII. Insights extras específicos de cada aba são adicionados na
// própria página (setores, on-chain, funding rate etc.).
export function buildGenericInsights(
  gainers: RankingItem[],
  losers: RankingItem[],
  byVolume: RankingItem[],
  zScoreHighlights: ZScoreHighlight[] = []
): string[] {
  const insights: string[] = [];

  gainers.slice(0, 4).forEach((g, i) => {
    insights.push(
      i === 0
        ? `${g.symbol} lidera as altas do dia (${formatPct(g.changePct)}).`
        : `${g.symbol} também entre as maiores altas (${formatPct(g.changePct)}).`
    );
  });
  losers.slice(0, 4).forEach((l, i) => {
    insights.push(
      i === 0
        ? `${l.symbol} lidera as baixas do dia (${formatPct(l.changePct)}).`
        : `${l.symbol} também entre as maiores baixas (${formatPct(l.changePct)}).`
    );
  });

  const volumeSymbols = new Set(byVolume.slice(0, 10).map((v) => v.symbol));
  const highConvictionMoves = [...gainers.slice(0, 10), ...losers.slice(0, 10)].filter((m) => volumeSymbols.has(m.symbol));
  highConvictionMoves.slice(0, 3).forEach((m) => {
    insights.push(
      `${m.symbol} está entre os maiores volumes E maiores movimentos do dia (${formatPct(m.changePct)}) — sinal de interesse forte, não só ruído.`
    );
  });

  zScoreHighlights
    .filter((z) => Math.abs(z.zScore) >= 2)
    .slice(0, 3)
    .forEach((z) => {
      insights.push(
        `${z.symbol} com z-score ${z.zScore >= 0 ? "+" : ""}${z.zScore.toFixed(1)} — movimento fora do padrão histórico do ativo.`
      );
    });

  if (byVolume[0]) {
    insights.push(`${byVolume[0].symbol} lidera o volume negociado do dia.`);
  }

  return insights;
}
